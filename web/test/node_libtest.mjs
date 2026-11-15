import fs from "node:fs";
import { logMel, decodeTokens, splitChunks } from "../hkasr-lib.js";
// mel_filters.bin + tokenizer_config.json are in test/model-small/; vocab.json comes from the Hugging Face model repo
const M = process.env.HKASR_MODEL_DIR || "./test/model-small/";
const fb = new Float32Array(fs.readFileSync(M + "mel_filters.bin").buffer.slice(0));
// read float32 wav (WAV FLOAT, 16k mono): find "data" chunk
const buf = fs.readFileSync("./test/wav/00.wav");
let off = 12, data;
while (off < buf.length) { const id = buf.toString("ascii", off, off + 4), sz = buf.readUInt32LE(off + 4); if (id === "data") { data = buf.subarray(off + 8, off + 8 + sz); break; } off += 8 + sz + (sz & 1); }
const wav = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
let t0 = performance.now();
const { mel, T } = logMel(wav, fb);
const ms = performance.now() - t0;
const ref = new Float32Array(fs.readFileSync("./test/mel_ref_00.bin").buffer.slice(0));
let md = 0, mean = 0; for (let i = 0; i < ref.length; i++) { const d = Math.abs(ref[i] - mel[i]); md = Math.max(md, d); mean += d; }
console.log("mel T", T, "ref len", ref.length / 128, "maxdiff", md, "meandiff", mean / ref.length, "ms", ms.toFixed(0), "audio s", wav.length / 16000);
const vocab = JSON.parse(fs.readFileSync(M + "vocab.json", "utf8")); const inv = []; for (const [k, v] of Object.entries(vocab)) inv[v] = k;
const tc = JSON.parse(fs.readFileSync(M + "tokenizer_config.json", "utf8"));
const added = new Map(Object.entries(tc.added_tokens_decoder).map(([k, v]) => [Number(k), v]));
const j = JSON.parse(fs.readFileSync("./test/decode_ref.json", "utf8"));
let ok = 0; for (const c of j.clips) { const t = decodeTokens(c.onnx_tokens, inv, added).trim(); if (t === c.pt_text) ok++; else console.log("DIFF", t, "|", c.pt_text); }
console.log("tokenizer decode match", ok, "/", j.clips.length);
const long = new Float32Array(16000 * 95).map((_, i) => Math.sin(i / 10) * (Math.floor(i / 16000) % 7 === 3 ? 0.001 : 0.5));
console.log("chunks", splitChunks(long).map(c => (c.length / 16000).toFixed(2)));
