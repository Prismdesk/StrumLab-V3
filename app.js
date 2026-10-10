'use strict';

/* ---------- Settings ---------- */
const DEFAULTS = {
  theme: 'system', size: 'medium', guitar: 'acoustic', capo: 0, noteColor: 'note', frets: '6',
  tuning: 'standard', customTuning: [40, 45, 50, 55, 59, 64],
  reverb: 'low', chorus: 'off', compressor: 'off', diagram: 'vertical'
};
let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('strumlab.settings') || '{}')); } catch (e) {}

function saveSettings() {
  try { localStorage.setItem('strumlab.settings', JSON.stringify(settings)); } catch (e) {}
}

function currentTuning() {
  if (settings.tuning === 'custom' && Array.isArray(settings.customTuning) && settings.customTuning.length === 6)
    return settings.customTuning.map(Number);
  return [...(TUNINGS.find(t => t.id === settings.tuning) || TUNINGS[0]).midi];
}

function setTuningMidis(arr) {
  const p = TUNINGS.find(t => t.midi.join() === arr.join());
  if (p) settings.tuning = p.id; else { settings.tuning = 'custom'; settings.customTuning = [...arr]; }
  saveSettings();
  applySettings();
  document.dispatchEvent(new Event('settingschange'));
}

function applySettings() {
  const root = document.documentElement;
  if (settings.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-size', settings.size);
  Engine.type = settings.guitar;
  Engine.midi = currentTuning();
  Engine.setFx();
  document.querySelectorAll('.seg').forEach(seg => {
    const key = seg.dataset.setting;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === String(settings[key])));
  });
  buildStrings();
}

document.querySelectorAll('.seg').forEach(seg => {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const key = seg.dataset.setting;
    settings[key] = b.dataset.value;
    saveSettings();
    applySettings();
    document.dispatchEvent(new Event('settingschange'));
    if (key === 'guitar') Engine.play([Engine.midi[2]]);
    if (key === 'reverb' || key === 'chorus' || key === 'compressor') Engine.play(Engine.midi.slice(1, 5), 0.04);
  });
});

/* ---------- Audio engine (synthesized plucked string, no audio files) ---------- */
const Engine = {
  ctx: null, master: null, cache: new Map(), type: 'acoustic', fx: null, voices: [], sat: null,
  midi: [...STD_TUNING],

  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const bq = (type, f, q = 0.7, gain = 0) => {
      const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = gain; return n;
    };
    const chain = (...nodes) => nodes.reduce((a, b) => { a.connect(b); return b; });

    // instrument tone: body / pickup EQ, gentle saturation (electric only), tone filter
    const master = this.master = g(1);
    const hp = bq('highpass', 70), p1 = bq('peaking', 100, 3), p2 = bq('peaking', 220, 2), p3 = bq('peaking', 2600, 1.2);
    const shaper = ctx.createWaveShaper(); shaper.oversample = '2x';
    const lp = bq('lowpass', 6500, 0.5), toneOut = g(0.9);
    chain(master, hp, p1, p2, p3, shaper, lp, toneOut);

    // chorus: two slowly modulated voices, panned apart, high-passed so the bass stays clean
    const cDry = g(1), cWet = g(0), cMix = g(1);
    toneOut.connect(cDry); cDry.connect(cMix); cWet.connect(cMix);
    [[0.017, 0.55, 0.0022, -0.7], [0.025, 0.8, 0.0028, 0.7]].forEach(([d, rate, depth, pan]) => {
      const dl = ctx.createDelay(0.06); dl.delayTime.value = d;
      const lfo = ctx.createOscillator(), lg = g(depth);
      lfo.frequency.value = rate; lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
      const hpw = bq('highpass', 250);
      toneOut.connect(dl); dl.connect(hpw);
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; hpw.connect(p); p.connect(cWet); }
      else hpw.connect(cWet);
    });

    // compressor + makeup gain
    const comp = ctx.createDynamicsCompressor(), makeup = g(1);
    comp.attack.value = 0.01; comp.release.value = 0.25; comp.knee.value = 24;
    chain(cMix, comp, makeup);

    // reverb: generated room tail, pre-delayed, with highs and lows trimmed so it never gets harsh or muddy
    const rDry = g(1), rWet = g(0), pre = ctx.createDelay(0.1);
    pre.delayTime.value = 0.018;
    const conv = ctx.createConvolver(); conv.buffer = this.impulse(1.4);
    chain(makeup, pre, conv, bq('lowpass', 4200, 0.5), bq('highpass', 200, 0.5), rWet);

    // safety limiter so stacked notes never clip
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.1; lim.knee.value = 0;
    makeup.connect(rDry); rDry.connect(lim); rWet.connect(lim); lim.connect(ctx.destination);

    this.fx = { hp, p1, p2, p3, shaper, lp, cWet, comp, makeup, rWet };
    this.setFx();
  },

  impulse(sec) {
    const sr = this.ctx.sampleRate, len = Math.floor(sr * sec), ir = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let y = 0, seed = ch * 7919 + 13;
      for (let i = 0; i < len; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        const t = i / len, k = 0.55 - 0.47 * t;             // tail gets darker as it decays
        y += k * ((seed / 233280) * 2 - 1 - y);
        d[i] = y * Math.exp(-6.9 * t) * (i < sr * 0.004 ? i / (sr * 0.004) : 1);
      }
    }
    return ir;
  },

  setFx() {
    const f = this.fx;
    if (!f) return;
    const el = this.type === 'electric';
    const T = el
      ? { p1: [140, 1, 1.5], p2: [900, 1, -2.5], p3: [2600, 1.3, 4.5], hp: 85, lp: 5200 }
      : { p1: [100, 3, 4.5], p2: [220, 2, 2.5], p3: [2600, 1.2, -1], hp: 70, lp: 6500 };
    [['p1', f.p1], ['p2', f.p2], ['p3', f.p3]].forEach(([k, n]) => { n.frequency.value = T[k][0]; n.Q.value = T[k][1]; n.gain.value = T[k][2]; });
    f.hp.frequency.value = T.hp; f.lp.frequency.value = T.lp;
    if (el && !this.sat) {
      this.sat = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; this.sat[i] = Math.tanh(1.4 * x) / Math.tanh(1.4); }
    }
    f.shaper.curve = el ? this.sat : null;
    const L = v => Math.max(0, ['off', 'low', 'med', 'high'].indexOf(v));
    f.rWet.gain.value = [0, 0.16, 0.3, 0.48][L(settings.reverb)];
    f.cWet.gain.value = [0, 0.28, 0.45, 0.65][L(settings.chorus)] * 0.7;
    const cp = L(settings.compressor);
    f.comp.threshold.value = [0, -20, -28, -36][cp];
    f.comp.ratio.value = [1, 2.5, 4, 8][cp];
    f.makeup.gain.value = [1, 1.1, 1.3, 1.55][cp];
  },

  async unlock() {
    this.init();
    if (this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) {} }
  },

  buffer(midi) {
    const key = this.type + midi;
    if (this.cache.has(key)) return this.cache.get(key);
    const data = synthPluck(midi, this.ctx.sampleRate, this.type === 'electric');
    const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(data);
    this.cache.set(key, buf);
    return buf;
  },

  pluck(midi, when = 0, vel = 1) {
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = this.buffer(midi);
    g.gain.value = 0.5 * vel;
    src.connect(g); g.connect(this.master);
    src.start(this.ctx.currentTime + when);
    const v = { src, g, midi };
    this.voices.push(v);
    src.onended = () => { this.voices = this.voices.filter(x => x !== v); };
  },

  // quick fade so a new strum or a re-plucked string doesn't pile up on what's still ringing
  choke(pred) {
    const now = this.ctx.currentTime;
    this.voices.filter(pred).forEach(v => {
      v.g.gain.cancelScheduledValues(now);
      v.g.gain.setTargetAtTime(0, now, 0.025);
      try { v.src.stop(now + 0.2); } catch (e) {}
    });
  },

  // gap in seconds between notes: ~0.04 strum, ~0.2 arpeggio. Strums get a little human timing and volume variation.
  async play(midis, gap = 0.04) {
    await this.unlock();
    if (midis.length > 1) this.choke(() => true);
    else if (midis.length) this.choke(v => v.midi === midis[0]);
    const human = midis.length > 1 && gap < 0.1;
    midis.forEach((m, i) => this.pluck(
      m,
      Math.max(0, i * gap + (human ? (Math.random() - 0.5) * 0.008 : 0)),
      Math.max(0.55, 1 - i * 0.025) * (0.93 + Math.random() * 0.14)
    ));
  }
};

/* ---------- Sound check ---------- */
function buildStrings() {
  const el = document.getElementById('strings');
  el.innerHTML = '';
  Engine.midi.forEach(m => {
    const b = document.createElement('button');
    b.textContent = noteLabel(m);
    b.setAttribute('aria-label', 'Play string ' + noteLabel(m));
    b.addEventListener('click', () => {
      Engine.play([m]);
      b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 180);
    });
    el.appendChild(b);
  });
}
document.getElementById('strum-test').addEventListener('click', () => Engine.play(Engine.midi, 0.045));

/* ---------- Tabs ---------- */
const tabButtons = document.querySelectorAll('#tabbar button');
function showTab(name) {
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'tab-' + name; });
  tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('tabshown', { detail: name }));
  try { localStorage.setItem('strumlab.tab', name); } catch (e) {}
}
tabButtons.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
let startTab = 'chords';
try { startTab = localStorage.getItem('strumlab.tab') || 'chords'; } catch (e) {}
if (!document.getElementById('tab-' + startTab)) startTab = 'chords';
showTab(startTab);
applySettings();

/* ---------- Offline / service worker ---------- */
const offlineEl = document.getElementById('offline-status');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { offlineEl.textContent = 'Ready. The app and all sounds work without internet.'; offlineEl.classList.add('ok'); })
    .catch(() => { offlineEl.textContent = 'Offline mode could not start. Open the app once with internet and reload.'; });
} else {
  offlineEl.textContent = 'This browser does not support offline mode.';
}
