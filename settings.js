'use strict';
/* Settings extras: tuning editor and export/import backup (loaded last) */
const tuningSel = $('tuning-select');
TUNINGS.forEach(t => tuningSel.appendChild(new Option(t.name + ' (' + t.midi.map(noteLabel).join(' ') + ')', t.id)));
tuningSel.appendChild(new Option('Custom…', 'custom'));

function renderTuning() {
  tuningSel.value = settings.tuning;
  const box = $('custom-tuning');
  box.hidden = settings.tuning !== 'custom';
  if (box.hidden) return;
  box.innerHTML = '';
  Engine.midi.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'trow';
    row.innerHTML = `<span>String ${6 - i}${i === 0 ? ' (low)' : i === 5 ? ' (high)' : ''}</span>
      <button data-i="${i}" data-d="-1" aria-label="Lower string ${6 - i}">−</button><output>${noteLabel(m)}</output><button data-i="${i}" data-d="1" aria-label="Raise string ${6 - i}">+</button>`;
    box.appendChild(row);
  });
}
tuningSel.addEventListener('change', () => {
  if (tuningSel.value === 'custom') settings.customTuning = [...Engine.midi];
  settings.tuning = tuningSel.value;
  saveSettings(); applySettings();
  document.dispatchEvent(new Event('settingschange'));
  Engine.play(Engine.midi, 0.045);
});
$('custom-tuning').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = +b.dataset.i, v = Math.max(28, Math.min(67, settings.customTuning[i] + +b.dataset.d));
  settings.customTuning[i] = v;
  saveSettings(); applySettings();
  document.dispatchEvent(new Event('settingschange'));
  Engine.play([v]);
});
document.addEventListener('settingschange', renderTuning);
renderTuning();

/* ----- Backup ----- */
const backupMsg = t => { $('backup-status').textContent = t; };
$('export-btn').addEventListener('click', () => {
  const data = { app: 'StrumLab', version: 1, exported: new Date().toISOString(), settings, chords: savedChords, scales: savedScales };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'strumlab-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  backupMsg(`Exported ${savedChords.length} chords and ${savedScales.length} scales.`);
});
$('import-btn').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'StrumLab') throw new Error('not a StrumLab backup');
    const okChord = c => c && c.id && c.name && Array.isArray(c.frets) && c.frets.length === 6;
    const okScale = s => s && s.id && s.name && Array.isArray(s.notes);
    const newC = (d.chords || []).filter(okChord).filter(c => !savedChords.some(x => x.id === c.id));
    const newS = (d.scales || []).filter(okScale).filter(s => !savedScales.some(x => x.id === s.id));
    savedChords = newC.concat(savedChords); savedScales = newS.concat(savedScales);
    persistChords(); persistScales(); renderSaved(); renderSavedScales();
    let msg = `Imported ${newC.length} chords and ${newS.length} scales (existing ones kept).`;
    if (d.settings && confirm('Also restore the settings from this backup?')) {
      settings = { ...DEFAULTS, ...d.settings };
      saveSettings(); applySettings();
      document.dispatchEvent(new Event('settingschange'));
      msg += ' Settings restored.';
    }
    backupMsg(msg);
  } catch (err) {
    backupMsg('That file could not be imported. Choose a StrumLab backup (.json).');
  }
});
