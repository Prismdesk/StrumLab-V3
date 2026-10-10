'use strict';
/* Plucked-string synthesis (no DOM, so it can be tested in Node).
   Karplus-Strong with: fractional-delay tuning (in tune at every fret), pitch-dependent sustain,
   a softened pick excitation with pick-position comb, and a short pick click. */
function synthPluck(midi, sr, electric) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const P = sr / f;                          // period in samples
  // loop lowpass weight (0.5 = darkest). Higher notes get less damping so they still ring.
  const a = 1 - (1 - (electric ? 0.76 : 0.68)) * Math.exp(-(midi - 40) / 36);
  const D = P - (1 - a);                     // delay line + allpass must supply this much
  let L = Math.floor(D), frac = D - L;
  if (frac < 0.5) { L -= 1; frac += 1; }     // keep the allpass coefficient small and stable
  const C = (1 - frac) / (1 + frac);

  const t60 = Math.max(1.2, (electric ? 6.0 : 4.8) - (midi - 40) * (electric ? 0.04 : 0.045));
  const g = Math.pow(10, -3 / (t60 * f));    // loop gain per period for the target decay time
  const len = Math.floor(sr * Math.min(t60 * 0.9 + 0.5, 5));

  // excitation: smoothed noise (less hiss), partial pick-position comb, no DC
  let seed = (midi * 7919 + 12345) % 233280;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  // two-pole lowpass on the noise burst; brighter for higher notes and for the electric pickup
  const fc = electric ? 1400 + (midi - 40) * 40 : 1000 + (midi - 40) * 35;
  const k = 1 - Math.exp(-2 * Math.PI * fc / sr);
  const ex = new Float32Array(L);
  let y = 0, y2 = 0;
  for (let i = 0; i < L; i++) { y += k * (rnd() - y); y2 += k * (y - y2); ex[i] = y2; }
  const pp = Math.max(1, Math.round(L * (electric ? 0.17 : 0.12)));
  const dl = new Float32Array(L);
  let mean = 0, peak = 1e-9;
  for (let i = 0; i < L; i++) { dl[i] = ex[i] - 0.5 * ex[(i - pp + L) % L]; mean += dl[i]; }
  mean /= L;
  for (let i = 0; i < L; i++) { dl[i] -= mean; peak = Math.max(peak, Math.abs(dl[i])); }
  for (let i = 0; i < L; i++) dl[i] /= peak;

  const out = new Float32Array(len);
  let idx = 0, lpPrev = 0, apIn = 0, apOut = 0;
  for (let i = 0; i < len; i++) {
    const x = dl[idx];
    out[i] = x;
    const lp = a * x + (1 - a) * lpPrev; lpPrev = x;
    const yv = C * lp + apIn - C * apOut; apIn = lp; apOut = yv;
    dl[idx] = g * yv;
    idx = (idx + 1) % L;
  }
  // pick click
  const clickLen = Math.floor(sr * 0.012), ca = electric ? 0.05 : 0.09;
  let cy = 0;
  for (let i = 0; i < clickLen; i++) { cy += 0.3 * (rnd() - cy); out[i] += cy * Math.exp(-i / (sr * 0.003)) * ca; }
  // normalise and fade the tail
  let m = 1e-9;
  for (let i = 0; i < len; i++) m = Math.max(m, Math.abs(out[i]));
  const fade = Math.floor(sr * 0.25);
  for (let i = 0; i < len; i++) {
    let v = out[i] / m * 0.9;
    if (i > len - fade) v *= (len - i) / fade;
    out[i] = v;
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = { synthPluck };
