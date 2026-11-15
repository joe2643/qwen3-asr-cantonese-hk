// HK Cantonese ASR worker: Qwen3-ASR-0.6B-Cantonese-HK (int8 ONNX) on onnxruntime-web (WebGPU / WASM)
import * as ort from "./ort/ort.webgpu.min.mjs";
import { logMel, decodeTokens as dec0, fixRepetitions, splitChunks, NMEL } from "./hkasr-lib.js";

let MODEL_DIR = new URL("./models/yue-0.6b-int8/", import.meta.url).href;
let CACHE_NAME = "hkasr-yue-0.6b-int8";
const SR = 16000, MAX_NEW_TOKENS = 512;
const UTF8 = new TextDecoder("utf-8", { fatal: false });
const decodeTokens = (ids) => dec0(ids, vocabInv, added);
const EOS = new Set([151643, 151645]);

let S = null;          // sessions
let cfg, emb, melFb, vocabInv, added, backend;
export {};
const post = (type, data = {}) => self.postMessage({ type, ...data });

// ---------------- download with cache + progress ----------------
async function fetchPart(url, onBytes) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  let resp = cache ? await cache.match(url) : null;
  const fromCache = !!resp;
  if (!resp) {
    resp = await fetch(url);
    if (!resp.ok) throw new Error(`下載失敗 ${resp.status} ${url}`);
  }
  const reader = resp.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length; onBytes(value.length, fromCache);
  }
  const out = new Uint8Array(got); let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  chunks.length = 0;
  if (!fromCache && cache) {
    try { await cache.put(url, new Response(out)); } catch (e) { /* quota: ignore */ }
  }
  return { bytes: out };
}

async function loadAll() {
  const man = await (await fetch(MODEL_DIR + "manifest.json", { cache: "no-cache" })).json();
  const totalBytes = man.files.reduce((a, f) => a + f.size, 0);
  let done = 0, cached = 0;
  const files = {};
  for (const f of man.files) {
    const buf = new Uint8Array(f.size); let off = 0;
    for (const p of f.parts) {
      const { bytes } = await fetchPart(MODEL_DIR + p.name, (n, fc) => {
        done += n; if (fc) cached += n;
        post("progress", { done, total: totalBytes, file: f.name, cached });
      });
      buf.set(bytes, off); off += bytes.length;
    }
    if (off !== f.size) throw new Error(`${f.name} 大細唔對 ${off} != ${f.size}`);
    files[f.name] = buf;
  }
  return files;
}

// ---------------- model ----------------
function f16ToF32(h) {
  const s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 31) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}
const F16 = new Float32Array(65536).map((_, i) => f16ToF32(i));
function embedRows(ids) {
  const H = 1024, out = new Float32Array(ids.length * H);
  for (let r = 0; r < ids.length; r++) { const b = ids[r] * H, o = r * H; for (let j = 0; j < H; j++) out[o + j] = F16[emb[b + j]]; }
  return out;
}
function argmax(a) { let bi = 0, bv = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > bv) { bv = a[i]; bi = i; } return bi; }

async function init(prefer, modelDir, modelId) {
  const t0 = performance.now();
  if (modelDir) { MODEL_DIR = new URL(modelDir, new URL("./", import.meta.url)).href; CACHE_NAME = "hkasr-" + (modelId || modelDir); }
  const files = await loadAll();
  post("status", { msg: "建立推理 session 中…" });
  cfg = JSON.parse(UTF8.decode(files["config.json"]));
  const vocab = JSON.parse(UTF8.decode(files["vocab.json"]));
  vocabInv = []; for (const [k, v] of Object.entries(vocab)) vocabInv[v] = k;
  const tc = JSON.parse(UTF8.decode(files["tokenizer_config.json"]));
  added = new Map(Object.entries(tc.added_tokens_decoder || {}).map(([k, v]) => [Number(k), v]));
  emb = new Uint16Array(files["embed_tokens.bin"].buffer);
  melFb = new Float32Array(files["mel_filters.bin"].buffer);

  const hasGPU = !!(self.navigator && navigator.gpu) && (await navigator.gpu.requestAdapter().catch(() => null));
  backend = prefer === "wasm" || !hasGPU ? "wasm" : "webgpu";
  ort.env.wasm.wasmPaths = new URL("./ort/", import.meta.url).href;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
  const base = { executionProviders: [backend], graphOptimizationLevel: "all" };
  const ext = [{ path: "decoder_weights.data", data: files["decoder_weights.data"] }];
  const kvGpu = backend === "webgpu" ? { preferredOutputLocation: { present_keys: "gpu-buffer", present_values: "gpu-buffer" } } : {};
  S = {};
  S.encoder = await ort.InferenceSession.create(files["encoder.onnx"], base);
  post("status", { msg: "encoder OK，載入 decoder…" });
  S.init = await ort.InferenceSession.create(files["decoder_init.onnx"], { ...base, ...kvGpu, externalData: ext });
  S.step = await ort.InferenceSession.create(files["decoder_step.onnx"], { ...base, ...kvGpu, externalData: ext });
  post("ready", { backend, threads: ort.env.wasm.numThreads, loadSec: (performance.now() - t0) / 1000, coi: self.crossOriginIsolated });
}

async function transcribeChunk(wav, onPartial) {
  const { mel, T } = logMel(wav, melFb);
  const tEnc = performance.now();
  const encOut = await S.encoder.run({ mel: new ort.Tensor("float32", mel, [1, NMEL, T]) });
  const af = encOut.audio_features;
  const A = af.dims[1];
  const wp = cfg.web_package;
  const ids = [...wp.prompt_prefix_ids, ...new Array(A).fill(wp.audio_pad_id), ...wp.prompt_suffix_ids];
  const pos = BigInt64Array.from(ids.map((_, i) => BigInt(i)));
  const encSec = (performance.now() - tEnc) / 1000;
  const tDec = performance.now();
  let r = await S.init.run({
    inputs_embeds: new ort.Tensor("float32", embedRows(ids), [1, ids.length, 1024]),
    position_ids: new ort.Tensor("int64", pos, [1, ids.length]),
    audio_features: af,
    audio_offset: new ort.Tensor("int64", BigInt64Array.from([BigInt(wp.prompt_prefix_ids.length)]), [1]),
  });
  af.dispose?.();
  let next = argmax(r.logits.data); r.logits.dispose?.();
  let pk = r.present_keys, pv = r.present_values, p = ids.length;
  const out = [];
  while (!EOS.has(next) && out.length < MAX_NEW_TOKENS) {
    out.push(next);
    if (out.length % 4 === 0) onPartial(out);
    const rr = await S.step.run({
      input_embeds: new ort.Tensor("float32", embedRows([next]), [1, 1, 1024]),
      position_ids: new ort.Tensor("int64", BigInt64Array.from([BigInt(p)]), [1, 1]),
      past_keys: pk, past_values: pv,
    });
    pk.dispose?.(); pv.dispose?.();
    pk = rr.present_keys; pv = rr.present_values;
    next = argmax(rr.logits.data); rr.logits.dispose?.(); p++;
  }
  pk.dispose?.(); pv.dispose?.();
  return { tokens: out, encSec, decSec: (performance.now() - tDec) / 1000, nTok: out.length };
}

async function transcribe(id, wav) {
  const t0 = performance.now();
  // float_range_normalize
  let peak = 0; for (let i = 0; i < wav.length; i++) peak = Math.max(peak, Math.abs(wav[i]));
  if (peak > 1) for (let i = 0; i < wav.length; i++) wav[i] /= peak;
  const chunks = splitChunks(wav);
  const texts = []; let enc = 0, dec = 0, ntok = 0;
  for (let c = 0; c < chunks.length; c++) {
    const res = await transcribeChunk(chunks[c], (toks) => {
      post("partial", { id, text: texts.join("") + decodeTokens(toks), chunk: c + 1, nChunks: chunks.length });
    });
    texts.push(fixRepetitions(decodeTokens(res.tokens).trim()));
    enc += res.encSec; dec += res.decSec; ntok += res.nTok;
    post("partial", { id, text: texts.join(""), chunk: c + 1, nChunks: chunks.length });
  }
  const sec = (performance.now() - t0) / 1000, dur = wav.length / SR;
  post("result", { id, text: texts.join(""), sec, dur, rtf: sec / dur, encSec: enc, decSec: dec, tokens: ntok, tokPerSec: ntok / dec, backend });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") await init(m.prefer, m.modelDir, m.modelId);
    else if (m.type === "transcribe") await transcribe(m.id, m.wav);
    else if (m.type === "mel") { const { mel, T } = logMel(m.wav, melFb); post("mel", { id: m.id, mel, T }); }
  } catch (err) {
    post("error", { id: m.id, msg: String(err && err.message || err), stack: String(err && err.stack || "") });
  }
};
