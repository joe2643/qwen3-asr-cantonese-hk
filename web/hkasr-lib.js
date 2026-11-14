// shared pure-JS helpers (no ORT): tokenizer decode, repetition fix, Whisper log-mel, chunking
export const SR = 16000, NFFT = 400, HOP = 160, NMEL = 128, NBIN = NFFT / 2 + 1;
export const MAX_CHUNK_SEC = 30, MIN_CHUNK_SEC = 0.5;
const UTF8 = new TextDecoder("utf-8", { fatal: false });
// ---------------- tokenizer (byte-level BPE decode only) ----------------
function bytesToUnicode() {
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice(); let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  const dec = new Map();
  bs.forEach((b, i) => dec.set(String.fromCharCode(cs[i]), b));
  return dec;
}
const BYTE_DEC = bytesToUnicode();
export function decodeTokens(ids, vocabInv, added) {
  let out = ""; let bytes = [];
  const flush = () => { if (bytes.length) { out += UTF8.decode(new Uint8Array(bytes)); bytes = []; } };
  for (const id of ids) {
    const a = added.get(id);
    if (a) { if (!a.special) { flush(); out += a.content; } continue; }
    const s = vocabInv[id];
    if (s === undefined) continue;
    for (const ch of s) { const b = BYTE_DEC.get(ch); if (b !== undefined) bytes.push(b); }
  }
  flush();
  return out;
}
// port of qwen_asr detect_and_fix_repetitions(threshold=20)
export function fixRepetitions(text, thresh = 20) {
  const fixChar = (s) => { let r = "", i = 0; const n = s.length;
    while (i < n) { let c = 1; while (i + c < n && s[i + c] === s[i]) c++; r += c > thresh ? s[i] : s.slice(i, i + c); i += c; } return r; };
  const fixPat = (s, maxLen = 20) => {
    const n = s.length; if (n < thresh * 2) return s;
    let i = 0; const res = []; let found = false;
    while (i <= n - thresh * 2) {
      found = false;
      for (let k = 1; k <= maxLen; k++) {
        if (i + k * thresh > n) break;
        const pat = s.slice(i, i + k); let ok = true;
        for (let r = 1; r < thresh; r++) if (s.slice(i + r * k, i + r * k + k) !== pat) { ok = false; break; }
        if (ok) { let end = i + thresh * k; while (end + k <= n && s.slice(end, end + k) === pat) end += k;
          res.push(pat); res.push(fixPat(s.slice(end), maxLen)); i = n; found = true; break; }
      }
      if (found) break; res.push(s[i]); i++;
    }
    if (!found) res.push(s.slice(i));
    return res.join("");
  };
  return fixPat(fixChar(text));
}
// python list slicing with Array.from on strings handles BMP; CJK is BMP so .slice is fine.

// ---------------- mel (Whisper-style, matches torch.stft center=True reflect) ----------------
const WIN = new Float64Array(NFFT).map((_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / NFFT));
// mixed-radix recursive complex FFT for N=400 (2^4 * 5^2)
function makeFFT(N) {
  const cos = new Float64Array(N), sin = new Float64Array(N);
  for (let i = 0; i < N; i++) { cos[i] = Math.cos((2 * Math.PI * i) / N); sin[i] = -Math.sin((2 * Math.PI * i) / N); }
  function rec(re, im, off, stride, n, outRe, outIm, o) {
    if (n === 1) { outRe[o] = re[off]; outIm[o] = im[off]; return; }
    let p = 2; while (n % p) p++;
    const m = n / p;
    for (let r = 0; r < p; r++) rec(re, im, off + r * stride, stride * p, m, outRe, outIm, o + r * m);
    const tRe = new Float64Array(n), tIm = new Float64Array(n);
    const tw = N / n;
    for (let k = 0; k < m; k++) {
      for (let q = 0; q < p; q++) {
        const kk = k + q * m; let sr = 0, si = 0;
        for (let r = 0; r < p; r++) {
          const idx = ((r * kk) % n) * tw;
          const yr = outRe[o + r * m + k], yi = outIm[o + r * m + k];
          sr += yr * cos[idx] - yi * sin[idx]; si += yr * sin[idx] + yi * cos[idx];
        }
        tRe[kk] = sr; tIm[kk] = si;
      }
    }
    for (let i = 0; i < n; i++) { outRe[o + i] = tRe[i]; outIm[o + i] = tIm[i]; }
  }
  return (re, im, outRe, outIm) => rec(re, im, 0, 1, N, outRe, outIm, 0);
}
const FFT = makeFFT(NFFT);
export function logMel(x, melFb) {
  const pad = NFFT / 2, L = x.length;
  const xp = new Float32Array(L + 2 * pad);
  xp.set(x, pad);
  for (let i = 1; i <= pad; i++) { xp[pad - i] = x[Math.min(i, L - 1)]; xp[pad + L - 1 + i] = x[Math.max(L - 1 - i, 0)]; }
  const T = 1 + Math.floor(L / HOP);
  const Tout = T - 1;
  const mel = new Float32Array(NMEL * Tout);
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT), oR = new Float64Array(NFFT), oI = new Float64Array(NFFT);
  const pw = new Float64Array(NBIN);
  let mx = -Infinity;
  for (let t = 0; t < Tout; t++) {
    const s = t * HOP;
    for (let n = 0; n < NFFT; n++) { re[n] = xp[s + n] * WIN[n]; im[n] = 0; }
    FFT(re, im, oR, oI);
    for (let k = 0; k < NBIN; k++) pw[k] = oR[k] * oR[k] + oI[k] * oI[k];
    for (let m = 0; m < NMEL; m++) {
      let acc = 0; const base = m * NBIN;
      for (let k = 0; k < NBIN; k++) acc += melFb[base + k] * pw[k];
      const v = Math.log10(Math.max(acc, 1e-10));
      mel[m * Tout + t] = v; if (v > mx) mx = v;
    }
  }
  const floor = mx - 8;
  for (let i = 0; i < mel.length; i++) mel[i] = (Math.max(mel[i], floor) + 4) / 4;
  return { mel, T: Tout };
}

// ---------------- audio chunking (port of split_audio_into_chunks) ----------------
export function splitChunks(wav) {
  const total = wav.length, maxLen = MAX_CHUNK_SEC * SR;
  if (total <= maxLen) return [wav];
  const expand = 5 * SR, win = Math.max(4, Math.floor(0.1 * SR));
  const out = []; let start = 0;
  while (total - start > maxLen) {
    const cut = start + maxLen, left = Math.max(start, cut - expand), right = Math.min(total, cut + expand);
    let boundary = cut;
    if (right - left > win) {
      let sum = 0; for (let i = left; i < left + win; i++) sum += Math.abs(wav[i]);
      let best = sum, bestPos = 0;
      for (let p = 1; p + win <= right - left; p++) {
        sum += Math.abs(wav[left + p + win - 1]) - Math.abs(wav[left + p - 1]);
        if (sum < best) { best = sum; bestPos = p; }
      }
      let inner = 0, mv = Infinity;
      for (let i = 0; i < win; i++) { const v = Math.abs(wav[left + bestPos + i]); if (v < mv) { mv = v; inner = i; } }
      boundary = left + bestPos + inner;
    }
    boundary = Math.min(Math.max(boundary, start + 1), total);
    out.push(wav.subarray(start, boundary)); start = boundary;
  }
  out.push(wav.subarray(start));
  return out.map((c) => {
    if (c.length >= MIN_CHUNK_SEC * SR) return c;
    const p = new Float32Array(MIN_CHUNK_SEC * SR); p.set(c); return p;
  });
}

