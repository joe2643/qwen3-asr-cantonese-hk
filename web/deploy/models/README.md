# Demo model files (`koelony-demo-models`)

The demo downloads its model (int8 ONNX, about 1.17 GB) from `/models/<id>/` on its own origin.
Workers static assets allow 25 MiB a file, so the files are cut into 24 MiB parts; `manifest.json`
lists the parts and `asr-worker.js` joins them back. This Worker has no route: `demo.koelony.com`
reaches it through the `MODELS` service binding in `../wrangler.jsonc`.

CI never touches it. When the model changes, rebuild and deploy it by hand:

```bash
cd web/deploy/models
node split.mjs /path/to/package yue-0.6b-int8 koelony/Qwen3-ASR-0.6B-Cantonese-HK
npx wrangler deploy          # CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN for the Koelony account
```

`/path/to/package` holds a `manifest.json` (same format) and the files or parts it lists.
Changing the files without changing the model id keeps visitors' cached copies (Cache API, keyed by
URL), so publish a new model under a new id in `../../models.json`.
