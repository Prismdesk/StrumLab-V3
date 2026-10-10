'use strict';
/* Music theory data: chord shapes and scales. No DOM code, so it can be tested anywhere. */
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const ROOT_LABELS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const X = null; // muted string

const CHORD_TYPES = [
  { id: 'maj', name: 'Major', sym: '', iv: [0, 4, 7] },
  { id: 'm', name: 'Minor', sym: 'm', iv: [0, 3, 7] },
  { id: '7', name: 'Dominant 7', sym: '7', iv: [0, 4, 7, 10] },
  { id: 'maj7', name: 'Major 7', sym: 'maj7', iv: [0, 4, 7, 11] },
  { id: 'm7', name: 'Minor 7', sym: 'm7', iv: [0, 3, 7, 10] },
  { id: 'sus2', name: 'Sus2', sym: 'sus2', iv: [0, 2, 7] },
  { id: 'sus4', name: 'Sus4', sym: 'sus4', iv: [0, 5, 7] },
  { id: '7sus4', name: '7sus4', sym: '7sus4', iv: [0, 5, 7, 10] },
  { id: 'dim', name: 'Diminished', sym: 'dim', iv: [0, 3, 6] },
  { id: 'dim7', name: 'Diminished 7', sym: 'dim7', iv: [0, 3, 6, 9] },
  { id: 'm7b5', name: 'Half-dim (m7♭5)', sym: 'm7♭5', iv: [0, 3, 6, 10] },
  { id: 'aug', name: 'Augmented', sym: 'aug', iv: [0, 4, 8] },
  { id: '6', name: 'Major 6', sym: '6', iv: [0, 4, 7, 9] },
  { id: 'm6', name: 'Minor 6', sym: 'm6', iv: [0, 3, 7, 9] },
  { id: '9', name: 'Dominant 9', sym: '9', iv: [0, 4, 7, 10, 2] },
  { id: 'add9', name: 'Add9', sym: 'add9', iv: [0, 4, 7, 2] },
  { id: '5', name: 'Power chord', sym: '5', iv: [0, 7] }
];

// Movable shapes by the string the root sits on (6 = low E, 5 = A, 4 = D). Numbers are frets relative to the root fret.
const SHAPES = {
  maj:  { 6: [0,2,2,1,0,0], 5: [X,0,2,2,2,0], 4: [X,X,0,2,3,2] },
  m:    { 6: [0,2,2,0,0,0], 5: [X,0,2,2,1,0], 4: [X,X,0,2,3,1] },
  7:    { 6: [0,2,0,1,0,0], 5: [X,0,2,0,2,0], 4: [X,X,0,2,1,2] },
  maj7: { 6: [0,2,1,1,0,0], 5: [X,0,2,1,2,0], 4: [X,X,0,2,2,2] },
  m7:   { 6: [0,2,0,0,0,0], 5: [X,0,2,0,1,0], 4: [X,X,0,2,1,1] },
  sus2: { 6: [0,2,4,4,0,0], 5: [X,0,2,2,0,0], 4: [X,X,0,2,3,0] },
  sus4: { 6: [0,2,2,2,0,0], 5: [X,0,2,2,3,0], 4: [X,X,0,2,3,3] },
  '7sus4': { 6: [0,2,0,2,0,0], 5: [X,0,2,0,3,0], 4: [X,X,0,2,1,3] },
  dim:  { 6: [0,1,2,0,X,X], 5: [X,0,1,2,1,X], 4: [X,X,0,1,3,1] },
  dim7: { 6: [0,1,X,0,2,X], 5: [X,0,1,2,1,2] },
  m7b5: { 6: [0,1,0,0,X,X], 5: [X,0,1,0,1,X] },
  aug:  { 6: [0,3,2,1,1,0], 5: [X,0,3,2,2,1], 4: [X,X,0,3,3,2] },
  6:    { 6: [0,2,2,1,2,0], 5: [X,0,2,2,2,2], 4: [X,X,0,2,0,2] },
  m6:   { 6: [0,2,2,0,2,0], 5: [X,0,2,2,1,2], 4: [X,X,0,2,0,1] },
  9:    { 6: [0,2,0,1,0,2], 5: [X,0,2,4,2,3] },
  add9: { 6: [0,2,2,1,0,2], 5: [X,0,2,4,2,0] },
  5:    { 6: [0,2,2,X,X,X], 5: [X,0,2,2,X,X] }
};

// Common open-position voicings that the movable shapes don't produce
const OPEN = {
  'C:maj': [X,3,2,0,1,0], 'G:maj': [3,2,0,0,0,3], 'G:7': [3,2,0,0,0,1], 'C:7': [X,3,2,3,1,0],
  'C:maj7': [X,3,2,0,0,0], 'F:maj7': [X,X,3,2,1,0], 'G:maj7': [3,2,0,0,0,2], 'B:7': [X,2,1,2,0,2],
  'C:add9': [X,3,2,0,3,0], 'G:sus4': [3,3,0,0,1,3], 'G:6': [3,2,0,0,0,0], 'A:m7': [X,0,2,0,1,0]
};

const STRING_PC = { 6: 4, 5: 9, 4: 2 }; // pitch class of the open string

function chordVoicings(root, type) {
  const out = [], seen = new Set();
  const add = (frets, label) => {
    if (Math.max(...frets.filter(f => f !== null)) > 15) return;
    const k = frets.join(',');
    if (!seen.has(k)) { seen.add(k); out.push({ frets, label }); }
  };
  const ov = OPEN[NOTE_NAMES[root] + ':' + type];
  if (ov) add(ov, 'Open');
  const sh = SHAPES[type] || {};
  [6, 5, 4].filter(s => sh[s]).map(s => ({ s, base: (root - STRING_PC[s] + 12) % 12 }))
    .sort((a, b) => a.base - b.base)
    .forEach(({ s, base }) => add(sh[s].map(r => r === null ? null : r + base), base === 0 ? 'Open' : 'Barre, fret ' + base));
  return out;
}

const SCALES = [
  { id: 'major', name: 'Major (Ionian)', cat: 'Common', iv: [0,2,4,5,7,9,11] },
  { id: 'minor', name: 'Natural minor (Aeolian)', cat: 'Common', iv: [0,2,3,5,7,8,10] },
  { id: 'harmonic-minor', name: 'Harmonic minor', cat: 'Common', iv: [0,2,3,5,7,8,11] },
  { id: 'melodic-minor', name: 'Melodic minor', cat: 'Common', iv: [0,2,3,5,7,9,11] },
  { id: 'harmonic-major', name: 'Harmonic major', cat: 'Common', iv: [0,2,4,5,7,8,11] },
  { id: 'dorian', name: 'Dorian', cat: 'Modes', iv: [0,2,3,5,7,9,10] },
  { id: 'phrygian', name: 'Phrygian', cat: 'Modes', iv: [0,1,3,5,7,8,10] },
  { id: 'lydian', name: 'Lydian', cat: 'Modes', iv: [0,2,4,6,7,9,11] },
  { id: 'mixolydian', name: 'Mixolydian', cat: 'Modes', iv: [0,2,4,5,7,9,10] },
  { id: 'locrian', name: 'Locrian', cat: 'Modes', iv: [0,1,3,5,6,8,10] },
  { id: 'lydian-dominant', name: 'Lydian dominant', cat: 'Modes', iv: [0,2,4,6,7,9,10] },
  { id: 'dorian-b2', name: 'Dorian ♭2', cat: 'Modes', iv: [0,1,3,5,7,9,10] },
  { id: 'lydian-aug', name: 'Lydian augmented', cat: 'Modes', iv: [0,2,4,6,8,9,11] },
  { id: 'altered', name: 'Altered (Super Locrian)', cat: 'Modes', iv: [0,1,3,4,6,8,10] },
  { id: 'locrian-n2', name: 'Locrian ♮2', cat: 'Modes', iv: [0,2,3,5,6,8,10] },
  { id: 'pent-major', name: 'Major pentatonic', cat: 'Pentatonic & blues', iv: [0,2,4,7,9] },
  { id: 'pent-minor', name: 'Minor pentatonic', cat: 'Pentatonic & blues', iv: [0,3,5,7,10] },
  { id: 'blues-minor', name: 'Blues (minor)', cat: 'Pentatonic & blues', iv: [0,3,5,6,7,10] },
  { id: 'blues-major', name: 'Blues (major)', cat: 'Pentatonic & blues', iv: [0,2,3,4,7,9] },
  { id: 'whole-tone', name: 'Whole tone', cat: 'Symmetric', iv: [0,2,4,6,8,10] },
  { id: 'dim-wh', name: 'Diminished (whole-half)', cat: 'Symmetric', iv: [0,2,3,5,6,8,9,11] },
  { id: 'dim-hw', name: 'Diminished (half-whole)', cat: 'Symmetric', iv: [0,1,3,4,6,7,9,10] },
  { id: 'bebop-dom', name: 'Bebop dominant', cat: 'Symmetric', iv: [0,2,4,5,7,9,10,11] },
  { id: 'chromatic', name: 'Chromatic', cat: 'Symmetric', iv: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { id: 'phrygian-dom', name: 'Phrygian dominant (Hijaz)', cat: 'Exotic & world', iv: [0,1,4,5,7,8,10] },
  { id: 'double-harmonic', name: 'Double harmonic (Byzantine)', cat: 'Exotic & world', iv: [0,1,4,5,7,8,11] },
  { id: 'hungarian-minor', name: 'Hungarian minor', cat: 'Exotic & world', iv: [0,2,3,6,7,8,11] },
  { id: 'hungarian-major', name: 'Hungarian major', cat: 'Exotic & world', iv: [0,3,4,6,7,9,10] },
  { id: 'ukrainian-dorian', name: 'Ukrainian Dorian', cat: 'Exotic & world', iv: [0,2,3,6,7,9,10] },
  { id: 'persian', name: 'Persian', cat: 'Exotic & world', iv: [0,1,4,5,6,8,11] },
  { id: 'neapolitan-minor', name: 'Neapolitan minor', cat: 'Exotic & world', iv: [0,1,3,5,7,8,11] },
  { id: 'neapolitan-major', name: 'Neapolitan major', cat: 'Exotic & world', iv: [0,1,3,5,7,9,11] },
  { id: 'spanish-8', name: 'Spanish 8-tone', cat: 'Exotic & world', iv: [0,1,3,4,5,6,8,10] },
  { id: 'enigmatic', name: 'Enigmatic', cat: 'Exotic & world', iv: [0,1,4,6,8,10,11] },
  { id: 'prometheus', name: 'Prometheus', cat: 'Exotic & world', iv: [0,2,4,6,9,10] },
  { id: 'hirajoshi', name: 'Hirajoshi (Japan)', cat: 'Exotic & world', iv: [0,2,3,7,8] },
  { id: 'in-sen', name: 'In Sen (Japan)', cat: 'Exotic & world', iv: [0,1,5,7,10] },
  { id: 'iwato', name: 'Iwato (Japan)', cat: 'Exotic & world', iv: [0,1,5,6,10] },
  { id: 'yo', name: 'Yo (Japan)', cat: 'Exotic & world', iv: [0,2,5,7,9] },
  { id: 'chinese', name: 'Chinese', cat: 'Exotic & world', iv: [0,4,6,7,11] },
  { id: 'egyptian', name: 'Egyptian', cat: 'Exotic & world', iv: [0,2,5,7,10] },
  { id: 'pelog', name: 'Pelog (Bali)', cat: 'Exotic & world', iv: [0,1,3,7,8] }
];


const TUNINGS = [
  { id: 'standard', name: 'Standard', midi: [40, 45, 50, 55, 59, 64] },
  { id: 'dropd', name: 'Drop D', midi: [38, 45, 50, 55, 59, 64] },
  { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  { id: 'openg', name: 'Open G', midi: [38, 43, 50, 55, 59, 62] },
  { id: 'opend', name: 'Open D', midi: [38, 45, 50, 54, 57, 62] },
  { id: 'opene', name: 'Open E', midi: [40, 47, 52, 56, 59, 64] },
  { id: 'halfdown', name: 'Half step down', midi: [39, 44, 49, 54, 58, 63] },
  { id: 'fulldown', name: 'Full step down', midi: [38, 43, 48, 53, 57, 62] }
];
const STD_TUNING = TUNINGS[0].midi;
const noteLabel = m => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const tuningName = arr => { const p = TUNINGS.find(x => x.midi.join() === arr.join()); return p ? p.name : 'Custom tuning'; };

// Name a set of sounding pitch classes (bass note is preferred as the root)
function identifyChord(pcs, bass) {
  const set = new Set(pcs);
  if (set.size < 2) return null;
  for (const r of [bass, ...[...set].filter(p => p !== bass)]) {
    for (const t of CHORD_TYPES) {
      if (t.iv.length === set.size && t.iv.every(i => set.has((r + i) % 12)))
        return { root: r, type: t, name: NOTE_NAMES[r] + t.sym + (r !== bass ? '/' + NOTE_NAMES[bass] : '') };
    }
  }
  return null;
}


// Name a set of pitch classes as a scale: exact matches on any root, otherwise common scales that contain every note
function identifyScales(pcs, bass) {
  const set = new Set(pcs), exact = [], fits = [];
  if (set.size < 3) return { exact, fits };
  const roots = [bass, ...[...set].filter(p => p !== bass)];
  for (const r of roots) for (const sc of SCALES) {
    const have = new Set(sc.iv.map(i => (r + i) % 12));
    if (have.size === set.size && [...set].every(p => have.has(p))) exact.push({ root: r, name: NOTE_NAMES[r] + ' ' + sc.name });
  }
  if (!exact.length) {
    const common = SCALES.filter(s => ['Common', 'Modes', 'Pentatonic & blues'].includes(s.cat));
    for (let r = 0; r < 12; r++) for (const sc of common) {
      const have = new Set(sc.iv.map(i => (r + i) % 12));
      if ([...set].every(p => have.has(p))) fits.push({ root: r, name: NOTE_NAMES[r] + ' ' + sc.name, size: sc.iv.length, own: r === bass ? 0 : 1 });
    }
    fits.sort((a, b) => a.own - b.own || a.size - b.size);
  }
  return { exact: exact.slice(0, 4), fits: fits.slice(0, 4) };
}

if (typeof module !== 'undefined') module.exports = { identifyScales, identifyChord, NOTE_NAMES, CHORD_TYPES, SHAPES, OPEN, chordVoicings, SCALES };
