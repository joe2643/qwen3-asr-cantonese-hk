# Web demo: Cantonese ASR in the browser

Live: https://hkasr.joe2643.work

Runs [joe2643/Qwen3-ASR-0.6B-Cantonese-HK](https://huggingface.co/joe2643/Qwen3-ASR-0.6B-Cantonese-HK) fully in the browser
(int8 ONNX, about 1.16 GB, cached with the Cache API after the first load). Inference uses
[onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) 1.31 on WebGPU, falling back to WASM. No audio leaves the device.

## Files

| File | What it does |
|---|---|
| `index.html`, `style.css`, `app.js` | UI: pick/drop a file, record, streaming partial text, copy, history |
| `asr-worker.js` | Web Worker: model download + cache, log-mel, encoder → decoder_init → decoder_step greedy decode, 30 s chunking |
| `hkasr-lib.js` | Pure-JS helpers: Whisper log-mel (max diff vs Python 2e-5), byte-level BPE decode, repetition fix, chunking |
| `models.json` | Model list shown in the UI (files live under `models/<id>/`, split into ≤ 256 MiB parts, see `manifest.json` there) |
| `_headers` | COOP/COEP headers (multi-threaded WASM needs cross-origin isolation) |
| `deploy/worker.js` | Cloudflare Worker: serves static assets, streams `/models/*` and `/ort/*.wasm` from R2 on the same origin |
| `test/` | 20 clips from FLEURS `yue_hant_hk` test (CC BY 4.0) for the in-page self test, plus a Node check of `hkasr-lib.js` |

## Run locally

```bash
cd web
npm ci
./build.sh                                   # copies the ORT runtime into ./ort and builds ./dist
python3 serve.py 18096 --remote https://hkasr.joe2643.work
# open http://127.0.0.1:18096/
```

`--remote` streams the model files and the ORT `.wasm` from the live site, so UI work does not need the model package.
Self test: `/?selftest=20`, or `/?selftest=5&backend=wasm`.

Node check of `hkasr-lib.js` (log-mel vs Python, tokenizer decode, chunking); `vocab.json` (2.7 MB) is fetched from Hugging Face:

```bash
curl -sfL -o test/model-small/vocab.json https://huggingface.co/joe2643/Qwen3-ASR-0.6B-Cantonese-HK/resolve/main/vocab.json
node test/node_libtest.mjs     # expect: mel maxdiff ~2e-5, tokenizer decode match 20 / 20
```

## CI / deploy

`.github/workflows/web.yml`: every PR and push that touches `web/` runs `npm ci`, `build.sh`, `node --check` and the Node test.
A push to `main` then deploys `dist/` + `deploy/worker.js` with `wrangler deploy -c deploy/wrangler.jsonc`.
The deploy job uses the `production` environment, so it waits for a maintainer to approve it.
Model files in R2 are never touched by CI.

Notes:
- Outside localhost the page must be served over HTTPS (WebGPU and the Cache API need a secure context).
- Keep COOP/COEP on every response; model files must be same-origin or CORP-compatible.
