#!/usr/bin/env bash
# Build the static site into web/dist (no model weights and no .wasm: those are served from R2 by deploy/worker.js).
# Usage: (cd web && npm ci && ./build.sh)
set -euo pipefail
cd "$(dirname "$0")"
ORT=node_modules/onnxruntime-web/dist
[ -f "$ORT/ort.webgpu.min.mjs" ] || { echo "run npm ci first" >&2; exit 1; }

# local dev copy of the ORT runtime (serve.py serves ./ort)
mkdir -p ort
cp -p "$ORT/ort.webgpu.min.mjs" "$ORT/ort-wasm-simd-threaded.asyncify.mjs" "$ORT/ort-wasm-simd-threaded.asyncify.wasm" ort/

out=dist
mkdir -p "$out/ort" "$out/test/wav"
cp -p index.html style.css app.js asr-worker.js hkasr-lib.js models.json _headers "$out/"
cp -p "$ORT/ort.webgpu.min.mjs" "$ORT/ort-wasm-simd-threaded.asyncify.mjs" "$out/ort/"
cp -p test/manifest.json test/mel_ref_00.bin "$out/test/"
cp -p test/wav/*.wav "$out/test/wav/"

# Workers static assets: no model files, no wasm (> 25 MiB limit), no symlinks
if find "$out" -type l -o -name '*.onnx' -o -name '*.data*' -o -name '*.wasm' | grep -q .; then
  echo "dist has forbidden files" >&2; exit 1
fi
if find "$out" -type f -size +24M | grep .; then echo "file > 24MB in dist" >&2; exit 1; fi
echo "built $out ($(du -sh "$out" | cut -f1))"
