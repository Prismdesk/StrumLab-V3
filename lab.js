'use strict';
/* Chord Lab: build, hear, name, save and edit chords (depends on theory.js, app.js, library.js) */
const ROLE_COLORS = { root: '#0f9e8e', third: '#c98500', fifth: '#3b82f6', seventh: '#a855f7', other: '#6b7280' };
const ROLE_LABELS = { root: 'Root', third: '3rd', fifth: '5th', seventh: '7th', other: 'Other' };
const LAB_TOTAL = 22, FW = 56, X0 = 44, SH = 34;
const lab = { frets: [null, null, null, null, null, null], editing: null };
let savedChords = [];
try { savedChords = JSON.parse(localStorage.getItem('strumlab.chords') || '[]'); } catch (e) {}
function persistChords() { try { localStorage.setItem('strumlab.chords', JSON.stringify(savedChords)); } catch (e) {} }

function chordInfo(frets, c, tuning = Engine.midi) {
  const midis = frets.map((f, i) => f === null ? null : tuning[i] + c + f);
  const sounding = midis.filter(m => m !== null);
  if (!sounding.length) return { midis, sounding, pcs: [], id: null, root: null };
  const pcs = [...new Set(sounding.map(m => m % 12))];
  const bass = Math.min(...sounding) % 12;
  const id = identifyChord(pcs, bass);
  return { midis, sounding, pcs, id, root: id ? id.root : bass };
}

function roleOf(pc, root) {
  const d = (pc - root + 12) % 12;
  if (d === 0) return 'root';
  if (d === 3 || d === 4) return 'third';
  if (d === 6 || d === 7 || d === 8) return 'fifth';
  if (d >= 9) return 'seventh';
  return 'other';
}
function noteColor(pc, st, info) {
  const mode = settings.noteColor;
  if (mode === 'role') return ROLE_COLORS[roleOf(pc, info.root)];
  if (mode === 'string') return `hsl(${st * 58 + 10} 60% 40%)`;
  return `hsl(${(pc * 30 + 170) % 360} 62% 40%)`;
}

function labBoardSvg(info, c) {
  const W = X0 + LAB_TOTAL * FW + 8, top = 24, H = top * 2 + 5 * SH + 22;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fretboard">`;
  for (let f = 0; f <= LAB_TOTAL; f++) s += `<line class="${f === 0 ? 'gn' : 'gf'}" x1="${X0 + f * FW}" y1="${top}" x2="${X0 + f * FW}" y2="${top + 5 * SH}"/>`;
  [3, 5, 7, 9, 12, 15, 17, 19, 21].forEach(a => {
    const f = a - c;
    if (f < 1 || f > LAB_TOTAL) return;
    const x = X0 + (f - 0.5) * FW;
    s += a === 12 ? `<circle class="inlay" cx="${x}" cy="${top + SH * 1.5}" r="6"/><circle class="inlay" cx="${x}" cy="${top + SH * 3.5}" r="6"/>` : `<circle class="inlay" cx="${x}" cy="${top + SH * 2.5}" r="6"/>`;
  });
  for (let st = 5; st >= 0; st--) s += `<line class="gs" x1="${X0}" y1="${top + st * SH}" x2="${X0 + LAB_TOTAL * FW}" y2="${top + st * SH}"/>`;
  for (let st = 0; st < 6; st++) {
    const y = top + st * SH, cur = lab.frets[st];
    s += `<rect class="hit" data-s="${st}" data-f="0" x="0" y="${y - SH / 2}" width="${X0}" height="${SH}"/>`;
    for (let f = 1; f <= LAB_TOTAL; f++) s += `<rect class="hit" data-s="${st}" data-f="${f}" x="${X0 + (f - 1) * FW}" y="${y - SH / 2}" width="${FW}" height="${SH}"/>`;
    if (cur === null) s += `<text class="gx" x="${X0 / 2}" y="${y + 5}" text-anchor="middle">×</text>`;
    else {
      const pc = (Engine.midi[st] + c + cur) % 12, x = cur === 0 ? X0 / 2 : X0 + (cur - 0.5) * FW;
      s += `<g class="bn"><circle cx="${x}" cy="${y}" r="13" style="fill:${noteColor(pc, st, info)}"/><text x="${x}" y="${y + 4}" text-anchor="middle">${NOTE_NAMES[pc]}</text></g>`;
    }
  }
  for (let f = 1; f <= LAB_TOTAL; f++) s += `<text class="fn" x="${X0 + (f - 0.5) * FW}" y="${H - 6}" text-anchor="middle">${f + c}</text>`;
  return s + '</svg>';
}

function renderLab() {
  const c = capo(), info = chordInfo(lab.frets, c);
  $('lab-board').innerHTML = labBoardSvg(info, c);
  const svg = $('lab-board').firstChild, w = $('lab-wrap').clientWidth;
  const full = X0 + LAB_TOTAL * FW + 8, vis = +settings.frets || 6;
  if (w) svg.style.width = Math.round((w - 6) * full / (X0 + vis * FW + 8)) + 'px';
  $('lab-name').textContent = info.sounding.length < 2 ? 'Tap frets to build a chord' : (info.id ? info.id.name : 'Unnamed chord');
  $('lab-notes').textContent = info.sounding.length ? info.sounding.map(m => NOTE_NAMES[m % 12]).join(' · ') : '';
  $('lab-update').hidden = !lab.editing;
  $('lab-legend').innerHTML = settings.noteColor === 'role'
    ? Object.keys(ROLE_COLORS).map(k => `<span><i style="background:${ROLE_COLORS[k]}"></i>${ROLE_LABELS[k]}</span>`).join('') : '';
  $('lab-name-input').placeholder = info.id ? info.id.name : 'Name (optional)';
}

function renderSaved() {
  const list = $('lab-saved');
  list.innerHTML = '';
  $('lab-empty').hidden = savedChords.length > 0;
  savedChords.forEach(ch => {
    const tun = ch.tuning || STD_TUNING, info = chordInfo(ch.frets, ch.capo || 0, tun);
    const card = document.createElement('div');
    card.className = 'card';
    const tones = info.sounding.map(m => NOTE_NAMES[m % 12]).join(' ');
    card.innerHTML = `<div class="dg">${chordSvg(ch.frets, info.root === null ? -1 : (info.root - (ch.capo || 0) + 12) % 12, tun)}</div>
      <h3></h3><p class="sub">${ch.capo ? 'Capo ' + ch.capo : 'No capo'}${tun.join() === STD_TUNING.join() ? '' : ' · ' + tuningName(tun)}</p><p class="tones">${tones}</p>
      <div class="acts"><button class="mini">Play</button><button class="mini">Edit</button><button class="mini">Delete</button></div>`;
    card.querySelector('h3').textContent = ch.name;
    const [play, edit, del] = card.querySelectorAll('.mini');
    const go = () => Engine.play(info.sounding, 0.04);
    play.addEventListener('click', go);
    card.querySelector('.dg').addEventListener('click', go);
    edit.addEventListener('click', () => {
      if (tun.join() !== Engine.midi.join()) setTuningMidis(tun);
      setCapo(ch.capo || 0);
      lab.frets = [...ch.frets]; lab.editing = ch.id;
      $('lab-name-input').value = ch.name;
      renderLab();
      window.scrollTo(0, 0);
    });
    del.addEventListener('click', () => {
      if (!confirm('Delete "' + ch.name + '"?')) return;
      savedChords = savedChords.filter(x => x.id !== ch.id);
      if (lab.editing === ch.id) lab.editing = null;
      persistChords(); renderSaved(); renderLab();
    });
    list.appendChild(card);
  });
}

function currentName(info) { return $('lab-name-input').value.trim() || (info.id ? info.id.name : 'My chord'); }

$('lab-board').addEventListener('click', e => {
  const t = e.target.closest('.hit');
  if (!t) return;
  const s = +t.dataset.s, f = +t.dataset.f;
  lab.frets[s] = f === 0 ? (lab.frets[s] === 0 ? null : 0) : (lab.frets[s] === f ? null : f);
  renderLab();
  if (lab.frets[s] !== null) Engine.play([Engine.midi[s] + capo() + lab.frets[s]]);
});
$('lab-strum').addEventListener('click', () => Engine.play(chordInfo(lab.frets, capo()).sounding, 0.04));
$('lab-arp').addEventListener('click', () => Engine.play(chordInfo(lab.frets, capo()).sounding, 0.2));
$('lab-clear').addEventListener('click', () => { lab.frets = [null, null, null, null, null, null]; lab.editing = null; $('lab-name-input').value = ''; renderLab(); });
$('lab-save').addEventListener('click', () => {
  const info = chordInfo(lab.frets, capo());
  if (!info.sounding.length) return;
  savedChords.unshift({ id: Date.now().toString(36), name: currentName(info), frets: [...lab.frets], capo: capo(), tuning: [...Engine.midi] });
  persistChords(); renderSaved();
});
$('lab-update').addEventListener('click', () => {
  const info = chordInfo(lab.frets, capo()), ch = savedChords.find(x => x.id === lab.editing);
  if (!ch || !info.sounding.length) return;
  Object.assign(ch, { name: currentName(info), frets: [...lab.frets], capo: capo(), tuning: [...Engine.midi] });
  persistChords(); renderSaved();
});

document.addEventListener('settingschange', renderLab);
document.addEventListener('tabshown', e => { if (e.detail === 'chordlab') renderLab(); });
window.addEventListener('resize', renderLab);
renderSaved();
renderLab();
