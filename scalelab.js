'use strict';
/* Scale Lab: pick any notes on the neck, hear them, name the scale, save and edit (uses lab.js helpers) */
const sl = { sel: new Set(), editing: null };
let savedScales = [];
try { savedScales = JSON.parse(localStorage.getItem('strumlab.scales') || '[]'); } catch (e) {}
function persistScales() { try { localStorage.setItem('strumlab.scales', JSON.stringify(savedScales)); } catch (e) {} }

function slInfo(sel, c, tuning = Engine.midi) {
  const all = [...sel].map(k => { const [s, f] = k.split(',').map(Number); return tuning[s] + c + f; });
  const sounding = [...new Set(all)].sort((a, b) => a - b);
  const pcs = [...new Set(sounding.map(m => m % 12))];
  const bass = sounding.length ? sounding[0] % 12 : null;
  const res = bass === null ? { exact: [], fits: [] } : identifyScales(pcs, bass);
  return { sounding, pcs, bass, res, root: res.exact.length ? res.exact[0].root : bass };
}
const slNames = midis => [...new Set(midis.map(m => NOTE_NAMES[m % 12]))].join(' · ');

function slBoardSvg(info, c) {
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
  const pcSet = new Set(info.pcs);
  for (let st = 0; st < 6; st++) {
    const y = top + st * SH;
    for (let f = 0; f <= LAB_TOTAL; f++) {
      const x = f === 0 ? X0 / 2 : X0 + (f - 0.5) * FW, pc = (Engine.midi[st] + c + f) % 12;
      s += `<rect class="hit" data-s="${st}" data-f="${f}" x="${f === 0 ? 0 : X0 + (f - 1) * FW}" y="${y - SH / 2}" width="${f === 0 ? X0 : FW}" height="${SH}"/>`;
      if (sl.sel.has(st + ',' + f)) s += `<g class="bn"><circle cx="${x}" cy="${y}" r="13" style="fill:${noteColor(pc, st, info)}"/><text x="${x}" y="${y + 4}" text-anchor="middle">${NOTE_NAMES[pc]}</text></g>`;
      else if (pcSet.has(pc)) s += `<g class="gh"><circle cx="${x}" cy="${y}" r="12"/><text x="${x}" y="${y + 3.5}" text-anchor="middle">${NOTE_NAMES[pc]}</text></g>`;
    }
  }
  for (let f = 1; f <= LAB_TOTAL; f++) s += `<text class="fn" x="${X0 + (f - 0.5) * FW}" y="${H - 6}" text-anchor="middle">${f + c}</text>`;
  return s + '</svg>';
}

function renderScaleLab() {
  const c = capo(), info = slInfo(sl.sel, c);
  $('sl-board').innerHTML = slBoardSvg(info, c);
  const svg = $('sl-board').firstChild, w = $('sl-wrap').clientWidth;
  const full = X0 + LAB_TOTAL * FW + 8, vis = +settings.frets || 6;
  if (w) svg.style.width = Math.round((w - 6) * full / (X0 + vis * FW + 8)) + 'px';
  const n = info.pcs.length, ex = info.res.exact, fits = info.res.fits;
  $('sl-name').textContent = n < 3 ? 'Tap frets to select notes' : (ex.length ? ex[0].name : 'Custom scale');
  $('sl-notes').textContent = info.sounding.length ? slNames(info.sounding) : '';
  $('sl-fits').textContent = ex.length > 1 ? 'Also: ' + ex.slice(1).map(x => x.name).join(', ')
    : (!ex.length && fits.length ? 'Fits within: ' + fits.map(x => x.name).join(', ') : '');
  $('sl-update').hidden = !sl.editing;
  $('sl-legend').innerHTML = settings.noteColor === 'role'
    ? Object.keys(ROLE_COLORS).map(k => `<span><i style="background:${ROLE_COLORS[k]}"></i>${ROLE_LABELS[k]}</span>`).join('') : '';
  $('sl-name-input').placeholder = ex.length ? ex[0].name : 'Name (optional)';
}

function renderSavedScales() {
  const list = $('sl-saved');
  list.innerHTML = '';
  $('sl-empty').hidden = savedScales.length > 0;
  savedScales.forEach(sc => {
    const tun = sc.tuning || STD_TUNING, keys = new Set(sc.notes.map(n => n.join(','))), info = slInfo(keys, sc.capo || 0, tun);
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = '<div class="txt"><h3></h3><p class="sub"></p></div><div class="acts"><button class="mini">Play</button><button class="mini">Edit</button><button class="mini">Delete</button></div>';
    item.querySelector('h3').textContent = sc.name;
    item.querySelector('.sub').textContent = slNames(info.sounding) + (sc.capo ? ' · capo ' + sc.capo : '') + (tun.join() === STD_TUNING.join() ? '' : ' · ' + tuningName(tun));
    const [play, edit, del] = item.querySelectorAll('.mini');
    play.addEventListener('click', () => Engine.play(info.sounding, 0.3));
    edit.addEventListener('click', () => {
      if (tun.join() !== Engine.midi.join()) setTuningMidis(tun);
      setCapo(sc.capo || 0);
      sl.sel = keys; sl.editing = sc.id;
      $('sl-name-input').value = sc.name;
      renderScaleLab();
      window.scrollTo(0, 0);
    });
    del.addEventListener('click', () => {
      if (!confirm('Delete "' + sc.name + '"?')) return;
      savedScales = savedScales.filter(x => x.id !== sc.id);
      if (sl.editing === sc.id) sl.editing = null;
      persistScales(); renderSavedScales(); renderScaleLab();
    });
    list.appendChild(item);
  });
}

const slName = info => $('sl-name-input').value.trim() || (info.res.exact.length ? info.res.exact[0].name : 'My scale');
const slNotes = () => [...sl.sel].map(k => k.split(',').map(Number));

$('sl-board').addEventListener('click', e => {
  const t = e.target.closest('.hit');
  if (!t) return;
  const s = +t.dataset.s, f = +t.dataset.f, k = s + ',' + f;
  if (sl.sel.has(k)) sl.sel.delete(k); else { sl.sel.add(k); Engine.play([Engine.midi[s] + capo() + f]); }
  renderScaleLab();
});
$('sl-play').addEventListener('click', () => Engine.play(slInfo(sl.sel, capo()).sounding, 0.3));
$('sl-updown').addEventListener('click', () => {
  const up = slInfo(sl.sel, capo()).sounding;
  Engine.play(up.concat(up.slice(0, -1).reverse()), 0.28);
});
$('sl-clear').addEventListener('click', () => { sl.sel = new Set(); sl.editing = null; $('sl-name-input').value = ''; renderScaleLab(); });
$('sl-save').addEventListener('click', () => {
  const info = slInfo(sl.sel, capo());
  if (!info.sounding.length) return;
  savedScales.unshift({ id: Date.now().toString(36), name: slName(info), notes: slNotes(), capo: capo(), tuning: [...Engine.midi] });
  persistScales(); renderSavedScales();
});
$('sl-update').addEventListener('click', () => {
  const info = slInfo(sl.sel, capo()), sc = savedScales.find(x => x.id === sl.editing);
  if (!sc || !info.sounding.length) return;
  Object.assign(sc, { name: slName(info), notes: slNotes(), capo: capo(), tuning: [...Engine.midi] });
  persistScales(); renderSavedScales();
});

document.addEventListener('settingschange', renderScaleLab);
document.addEventListener('tabshown', e => { if (e.detail === 'scalelab') renderScaleLab(); });
window.addEventListener('resize', renderScaleLab);
renderSavedScales();
renderScaleLab();
