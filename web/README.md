# Web demo: Cantonese ASR in the browser

Live: https://demo.koelony.com

Runs [koelony/Qwen3-ASR-0.6B-Cantonese-HK](https://huggingface.co/koelony/Qwen3-ASR-0.6B-Cantonese-HK) fully in the browser
(int8 ONNX, about 1.16 GB, cached with the Cache API after the first load). Inference uses
[onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) 1.31 on WebGPU, falling back to WASM. No audio leaves the device.

## Files

| File | What it does |
|---|---|
| `index.html`, `style.css`, `app.js` | UI, styled after [koelony.com](https://koelony.com): pick/drop a file, record, streaming partial text, copy, history; device check (mobile notice, WebGPU), 0.6B vs 1.7B accuracy chart, OraType section |
| `fonts/`, `favicon.svg` | Koelony look: Chiron GoRound TC (SIL OFL, `fonts/OFL.txt`) cut down to the characters the headings use, and the logo. Same-origin because of COEP. After changing heading or button text, run `node fonts/fetch-fonts.mjs` |
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
python3 serve.py 18096 --remote https://demo.koelony.com
# open http://127.0.0.1:18096/
```

`--remote` streams the model files and the ORT `.wasm` from the live site, so UI work does not need the model package.
Self test: `/?selftest=20`, or `/?selftest=5&backend=wasm`.

Node check of `hkasr-lib.js` (log-mel vs Python, tokenizer decode, chunking); `vocab.json` (2.7 MB) is fetched from Hugging Face:

```bash
curl -sfL -o test/model-small/vocab.json https://huggingface.co/koelony/Qwen3-ASR-0.6B-Cantonese-HK/resolve/main/vocab.json
node test/node_libtest.mjs     # expect: mel maxdiff ~2e-5, tokenizer decode match 20 / 20
```

## CI / deploy

`.github/workflows/web.yml`: every PR and push that touches `web/` runs `npm ci`, `build.sh`, `node --check` and the Node test.
A push to `main` then deploys `dist/` + `deploy/worker.js` to **demo.koelony.com** (Worker `koelony-demo` on
Koelony's Cloudflare account) with `wrangler deploy -c deploy/wrangler.jsonc`. The deploy job uses the `production`
environment, so it waits for a maintainer to approve it; its `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are
Koelony's.

Where the big files come from (Workers static assets allow 25 MiB a file, and the page must stay cross-origin isolated,
so `deploy/worker.js` serves both from this origin):
- `/models/*`: the `koelony-demo-models` Worker through a service binding: the model cut into 24 MiB parts. CI never
  touches it; see [`deploy/models/README.md`](deploy/models/README.md) to rebuild it.
- `/ort/*.wasm`: onnxruntime-web from jsDelivr at `ORT_VERSION` in `deploy/wrangler.jsonc`; `build.sh` fails if that
  differs from the installed onnxruntime-web.

Notes:
- Outside localhost the page must be served over HTTPS (WebGPU and the Cache API need a secure context).
- Keep COOP/COEP on every response; model files must be same-origin or CORP-compatible.
