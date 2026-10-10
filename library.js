'use strict';
/* Chord Library and Scale Library (depends on theory.js and app.js) */
const lib = { chordRoot: 0, chordType: 'maj', scaleRoot: 0, scaleId: 'major' };
const $ = id => document.getElementById(id);
const capo = () => settings.capo | 0;

function makeChips(el, items, sel, onPick) {
  el.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'chip' + (it.id === sel ? ' on' : '');
    b.textContent = it.label;
    b.addEventListener('click', () => onPick(it.id));
    el.appendChild(b);
  });
  const on = el.querySelector('.on');
  if (on && el.clientWidth) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2;
}

/* ----- Capo ----- */
function buildCapo(el) {
  el.className = 'capo';
  el.innerHTML = '<span>Capo</span><button aria-label="Lower capo">−</button><output>Off</output><button aria-label="Raise capo">+</button>';
  const [dn, up] = el.querySelectorAll('button');
  dn.addEventListener('click', () => setCapo(capo() - 1));
  up.addEventListener('click', () => setCapo(capo() + 1));
}
function setCapo(n) {
  settings.capo = Math.max(0, Math.min(9, n));
  saveSettings();
  renderAll();
  document.dispatchEvent(new Event('settingschange'));
}

/* ----- Chord diagram (vertical box) ----- */
function chordSvgV(frets, shapeRoot, tuning = STD_TUNING) {
  const used = frets.filter(f => f !== null && f > 0);
  const maxF = used.length ? Math.max(...used) : 1, minF = used.length ? Math.min(...used) : 1;
  const start = maxF <= 5 ? 1 : minF;
  let s = '<svg viewBox="0 0 124 150" role="img" aria-label="Chord diagram">';
  for (let i = 0; i < 6; i++) s += `<line class="gs" x1="${20 + i * 16}" y1="34" x2="${20 + i * 16}" y2="134"/>`;
  for (let j = 0; j <= 5; j++) s += `<line class="${j === 0 && start === 1 ? 'gn' : 'gf'}" x1="20" y1="${34 + j * 20}" x2="100" y2="${34 + j * 20}"/>`;
  if (start > 1) s += `<text class="gt" x="105" y="48">${start}fr</text>`;
  frets.forEach((f, i) => {
    const x = 20 + i * 16;
    if (f === null) s += `<text class="gx" x="${x}" y="27" text-anchor="middle">×</text>`;
    else if (f === 0) s += `<circle class="go" cx="${x}" cy="23" r="4.5"/>`;
    else {
      const root = (tuning[i] + f) % 12 === shapeRoot;
      s += `<circle class="${root ? 'dr' : 'dd'}" cx="${x}" cy="${34 + (f - start) * 20 + 10}" r="7"/>`;
    }
  });
  return s + '</svg>';
}

// Horizontal fretboard-style diagram (low string at the bottom)
function chordSvgH(frets, shapeRoot, tuning = STD_TUNING) {
  const used = frets.filter(f => f !== null && f > 0);
  const maxF = used.length ? Math.max(...used) : 1, minF = used.length ? Math.min(...used) : 1;
  const start = maxF <= 5 ? 1 : minF;
  let s = '<svg class="h" viewBox="0 0 150 124" role="img" aria-label="Chord diagram">';
  for (let i = 0; i < 6; i++) s += `<line class="gs" x1="34" y1="${20 + i * 16}" x2="134" y2="${20 + i * 16}"/>`;
  for (let j = 0; j <= 5; j++) s += `<line class="${j === 0 && start === 1 ? 'gn' : 'gf'}" x1="${34 + j * 20}" y1="20" x2="${34 + j * 20}" y2="100"/>`;
  if (start > 1) s += `<text class="gt" x="44" y="116" text-anchor="middle">${start}fr</text>`;
  frets.forEach((f, i) => {
    const y = 20 + i * 16;
    if (f === null) s += `<text class="gx" x="21" y="${y + 5}" text-anchor="middle">×</text>`;
    else if (f === 0) s += `<circle class="go" cx="21" cy="${y}" r="4.5"/>`;
    else {
      const root = (tuning[i] + f) % 12 === shapeRoot;
      s += `<circle class="${root ? 'dr' : 'dd'}" cx="${34 + (f - start) * 20 + 10}" cy="${y}" r="7"/>`;
    }
  });
  return s + '</svg>';
}
const chordSvg = (frets, shapeRoot, tuning = STD_TUNING) =>
  (settings.diagram === 'horizontal' ? chordSvgH : chordSvgV)(frets, shapeRoot, tuning);

function renderChords() {
  const c = capo(), sr = (lib.chordRoot - c + 12) % 12;
  const t = CHORD_TYPES.find(x => x.id === lib.chordType);
  makeChips($('chord-roots'), ROOT_LABELS.map((l, i) => ({ id: i, label: l })), lib.chordRoot, id => { lib.chordRoot = id; renderChords(); });
  makeChips($('chord-types'), CHORD_TYPES.map(x => ({ id: x.id, label: x.name })), lib.chordType, id => { lib.chordType = id; renderChords(); });
  $('chord-note').hidden = settings.tuning === 'standard';
  const list = $('chord-list');
  list.innerHTML = '';
  const name = NOTE_NAMES[lib.chordRoot] + t.sym;
  const tones = t.iv.map(i => NOTE_NAMES[(lib.chordRoot + i) % 12]).join(' ');
  chordVoicings(sr, t.id).forEach(v => {
    const midis = v.frets.map((f, i) => f === null ? null : STD_TUNING[i] + f + c).filter(m => m !== null);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="dg">${chordSvg(v.frets, sr)}</div><h3>${name}</h3>
      <p class="sub">${v.label}${c ? ` · ${NOTE_NAMES[sr]}${t.sym} shape, capo ${c}` : ''}</p>
      <p class="tones">${tones}</p>
      <div class="acts"><button class="mini">Strum</button><button class="mini">Arpeggio</button></div>`;
    const [strum, arp] = card.querySelectorAll('.mini');
    strum.addEventListener('click', () => Engine.play(midis, 0.04));
    arp.addEventListener('click', () => Engine.play(midis, 0.2));
    card.querySelector('.dg').addEventListener('click', () => Engine.play(midis, 0.04));
    list.appendChild(card);
  });
}

/* ----- Scales ----- */
function scaleMidis(sc, root, down) {
  const base = 48 + root;
  const up = sc.iv.map(i => base + i).concat(base + 12);
  return down ? up.concat(up.slice(0, -1).reverse()) : up;
}

function fretboardSvg(sc, root) {
  const c = capo(), FR = 15, W = 40 + FR * 52, set = new Set(sc.iv.map(i => (root + i) % 12));
  let s = `<svg viewBox="0 0 ${W} 214" role="img" aria-label="Scale on the fretboard">`;
  for (let f = 0; f <= FR; f++) s += `<line class="${f === 0 ? 'gn' : 'gf'}" x1="${36 + f * 52}" y1="20" x2="${36 + f * 52}" y2="160"/>`;
  [3, 5, 7, 9, 12, 15].forEach(a => {
    const f = a - c;
    if (f >= 1 && f <= FR) s += `<circle class="inlay" cx="${36 + (f - 0.5) * 52}" cy="${a === 12 ? 66 : 90}" r="5"/>` + (a === 12 ? `<circle class="inlay" cx="${36 + (f - 0.5) * 52}" cy="114" r="5"/>` : '');
  });
  for (let st = 5; st >= 0; st--) s += `<line class="gs" x1="36" y1="${20 + st * 28}" x2="${36 + FR * 52}" y2="${20 + st * 28}"/>`;
  for (let st = 5; st >= 0; st--) {
    const y = 20 + st * 28;
    for (let f = 0; f <= FR; f++) {
      const m = Engine.midi[st] + c + f, pc = m % 12;
      if (!set.has(pc)) continue;
      const x = f === 0 ? 18 : 36 + (f - 0.5) * 52;
      s += `<g class="nt ${pc === root ? 'rt' : ''}" data-midi="${m}"><circle cx="${x}" cy="${y}" r="12"/><text x="${x}" y="${y + 4}" text-anchor="middle">${NOTE_NAMES[pc]}</text></g>`;
    }
  }
  for (let f = 1; f <= FR; f++) s += `<text class="fn" x="${36 + (f - 0.5) * 52}" y="184" text-anchor="middle">${f + c}</text>`;
  return s + '</svg>';
}

function renderScales() {
  const sc = SCALES.find(x => x.id === lib.scaleId), root = lib.scaleRoot;
  makeChips($('scale-roots'), ROOT_LABELS.map((l, i) => ({ id: i, label: l })), root, id => { lib.scaleRoot = id; renderScales(); });
  $('scale-select').value = sc.id;
  const notes = $('scale-notes');
  notes.innerHTML = '';
  sc.iv.forEach((iv, i) => {
    const b = document.createElement('button');
    b.className = 'chip note' + (i === 0 ? ' on' : '');
    b.textContent = NOTE_NAMES[(root + iv) % 12];
    b.addEventListener('click', () => Engine.play([48 + root + iv]));
    notes.appendChild(b);
  });
  $('scale-formula').textContent = sc.iv.length + ' notes · ' + sc.cat + (capo() ? ` · capo ${capo()} (frets counted from the capo)` : '');
  $('fretboard').innerHTML = fretboardSvg(sc, root);
}

function initScaleSelect() {
  const sel = $('scale-select'), cats = [...new Set(SCALES.map(s => s.cat))];
  cats.forEach(cat => {
    const g = document.createElement('optgroup');
    g.label = cat;
    SCALES.filter(s => s.cat === cat).forEach(s => g.appendChild(new Option(s.name, s.id)));
    sel.appendChild(g);
  });
  sel.addEventListener('change', () => { lib.scaleId = sel.value; renderScales(); });
  $('fretboard').addEventListener('click', e => {
    const g = e.target.closest('.nt');
    if (g) Engine.play([+g.dataset.midi]);
  });
  $('play-up').addEventListener('click', () => Engine.play(scaleMidis(SCALES.find(s => s.id === lib.scaleId), lib.scaleRoot, false), 0.3));
  $('play-updown').addEventListener('click', () => Engine.play(scaleMidis(SCALES.find(s => s.id === lib.scaleId), lib.scaleRoot, true), 0.28));
}

function renderAll() {
  document.querySelectorAll('.capo output').forEach(o => { o.textContent = capo() ? capo() : 'Off'; });
  renderChords();
  renderScales();
}

document.querySelectorAll('.capo-slot').forEach(buildCapo);
initScaleSelect();
renderAll();
document.addEventListener('settingschange', () => { renderChords(); renderScales(); });
