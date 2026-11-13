# Qwen3-ASR Cantonese (Hong Kong)

[![Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Models-blue)](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Buy Me a Lemon Tea](https://img.shields.io/badge/%F0%9F%8D%8B%20Buy%20Me%20a%20Lemon%20Tea-ffdd00)](https://buymeacoffee.com/joe2643)

Fine-tunes of [`Qwen/Qwen3-ASR-1.7B`](https://huggingface.co/Qwen/Qwen3-ASR-1.7B) and
[`Qwen/Qwen3-ASR-0.6B`](https://huggingface.co/Qwen/Qwen3-ASR-0.6B) for **Hong Kong colloquial Cantonese with English
code-switching**. It writes Hong Kong Traditional Chinese with the characters people actually use when
they speak (`係`, `喺`, `嘅`, `咗`, `㗎`, `撚`, `屌`), keeps English words in English, and avoids the Simplified or
Mainland-style output of the stock model.

- **1.7B**: the most accurate. Use it on a desktop or server.
- **0.6B**: about one-third the size. It was also trained on short voice commands (`閂燈`, `開燈`, `閂冷氣`) and on
  hotword context that it uses when relevant and does not copy when not.

## Available weights & quantizations

| Hugging Face repo | Format | Size | Runtime / target |
|---|---|---:|---|
| [`joe2643/Qwen3-ASR-1.7B-Cantonese-HK`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK) | BF16 (`safetensors`) + `comfyui/` single-file | 4.08 GB | `transformers`, `qwen-asr`, vLLM, [ComfyUI-Drama3](https://github.com/PedroMarinhoDev/ComfyUI-Drama3) |
| [`joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF) | GGUF `Q4_K_M` / `Q6_K` / `Q8_0` + `mmproj-Q8_0` | 1.1–1.8 GB + 356 MB | `llama.cpp` (`llama-server`), [OraType](https://github.com/sennett-lau/oratype) |
| [`joe2643/Qwen3-ASR-1.7B-Cantonese-HK-FP8`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-FP8) | FP8 W8A8 (`compressed-tensors`) | 2.67 GB | vLLM (`FP8_DYNAMIC`, larger KV-cache headroom) |
| [`joe2643/Qwen3-ASR-1.7B-Cantonese-HK-NVFP4`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-NVFP4) | NVFP4A16 (`compressed-tensors`) | 2.05 GB | vLLM (fastest GPU throughput, smallest VRAM) |
| [`joe2643/Qwen3-ASR-0.6B-Cantonese-HK`](https://huggingface.co/joe2643/Qwen3-ASR-0.6B-Cantonese-HK) | 0.6B BF16 (`safetensors`) | 1.56 GB | `transformers`, `qwen-asr`, vLLM |
| [`joe2643/Qwen3-ASR-0.6B-Cantonese-HK-GGUF`](https://huggingface.co/joe2643/Qwen3-ASR-0.6B-Cantonese-HK-GGUF) | 0.6B GGUF `Q4_K_M` / `Q6_K` / `Q8_0` + `mmproj-Q8_0` | 397–639 MB + 214 MB | `llama.cpp` (`llama-server`), edge devices |

## Benchmark

Character error rate, greedy decoding, BF16 `transformers`, language forced to Cantonese. Before scoring, text is
converted to Simplified (OpenCC `t2s`), numbers are normalised and spaces removed.

### 1.7B

| Test set | Stock `Qwen3-ASR-1.7B` | v1 | **v2 (current)** | `whisper-large-v3` |
|---|---:|---:|---:|---:|
| FLEURS (`yue_hant_hk`) | 4.20% | 4.00% | **3.95%** | 20.97% |
| Common Voice `yue` | 5.46% | **3.80%** | 3.86% | 36.44% |
| Common Voice 23 `zh-HK` | 7.65% | 5.18% | **5.09%** | 41.76% |
| MDCC | 4.25% | 2.53% | **2.49%** | 34.52% |
| LegCo (HK Legislative Council) | 7.22% | 7.17% | **7.16%** | 32.15% |
| MCE (Cantonese–English code-switching) | 11.74% | **5.61%** | 5.62% | 24.00% |

#### 1.7B quantized variants

- **GGUF (`llama-server`, 60-clip check without number normalisation):** `Q4_K_M` 4.04%, `Q6_K` 2.95%, `Q8_0` 3.01%.
- **vLLM (`qwen-asr[vllm]` 0.0.6 on RTX 4090, FLEURS `yue_hant_hk` 819 clips / 2.65 h audio):**

| Variant | Weights | FLEURS CER | Batch time (2.65 h audio) | Single-clip p50 |
|---|---:|---:|---:|---:|
| BF16 | 4.08 GB | 3.96% | 11.6 s | 0.22 s |
| FP8 (`FP8_DYNAMIC`) | 2.67 GB | 4.05% | 41.8 s | 0.50 s |
| NVFP4 (`NVFP4A16`) | 2.05 GB | 4.49% | **8.4 s** | **0.13 s** |

### 0.6B

| Test set | Stock `Qwen3-ASR-0.6B` | **0.6B fine-tune** | 1.7B v2, for comparison |
|---|---:|---:|---:|
| FLEURS (`yue_hant_hk`) | 6.10% | **5.70%** | 3.95% |
| Common Voice `yue` | 6.84% | **5.12%** | 3.86% |
| Common Voice 23 `zh-HK` | 9.55% | **6.44%** | 5.09% |
| MDCC | 5.45% | **3.29%** | 2.49% |
| LegCo (HK Legislative Council) | 8.81% | **7.62%** | 7.16% |
| MCE (Cantonese–English code-switching) | 15.52% | **6.98%** | 5.62% |

Hotword context, 210-clip stress suite. Parrot rate is how often the model writes a hotword that was not spoken.

| Condition | Stock `Qwen3-ASR-0.6B` CER | **0.6B fine-tune** CER | Parrot rate |
|---|---:|---:|---:|
| Relevant hotwords + homophone distractors | 11.23% | **8.14%** | **0.0%** |
| Only irrelevant hotwords | 15.69% | **11.92%** | **0.0%** |
| Very short audio + long hotword list | 14.38% | **12.50%** | **0.0%** |

- **GGUF (`llama-server`, 60-clip check without number normalisation):** `Q4_K_M` 4.76%, `Q6_K` 4.52%, `Q8_0` 4.76%.

## Quick start (`llama.cpp` / GGUF)

You need a `llama.cpp` build with Qwen3-ASR audio support (tested with commit `78ffbaa`, 2026-11-10).

```sh
hf download joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF \
  Qwen3-ASR-1.7B-Cantonese-HK.Q4_K_M.gguf Qwen3-ASR-1.7B-Cantonese-HK.mmproj-Q8_0.gguf --local-dir models

llama-server \
  -m models/Qwen3-ASR-1.7B-Cantonese-HK.Q4_K_M.gguf \
  --mmproj models/Qwen3-ASR-1.7B-Cantonese-HK.mmproj-Q8_0.gguf \
  --host 127.0.0.1 --port 8180 -c 4096 -np 1
```

Then transcribe any audio file (needs `ffmpeg`, nothing else):

```sh
python examples/transcribe.py clip.m4a another.wav
```

Or call the OpenAI-compatible endpoint yourself:

```sh
curl http://127.0.0.1:8180/v1/chat/completions -H "Content-Type: application/json" -d '{
  "messages": [{"role": "user", "content": [{"type": "input_audio",
    "input_audio": {"data": "'"$(base64 -w0 clip.wav)"'", "format": "wav"}}]}],
  "temperature": 0}'
```

The reply looks like `language Cantonese<asr_text>…`; the transcript is the part after `<asr_text>`.
On a Ryzen AI Max+ 395 with a CPU-only build, `Q4_K_M` takes about 0.45 s for a 3 s clip.

| File | Size | Use |
|---|---:|---|
| `Qwen3-ASR-1.7B-Cantonese-HK.Q4_K_M.gguf` | 1.1 GB | default, fastest |
| `Qwen3-ASR-1.7B-Cantonese-HK.Q6_K.gguf` | 1.4 GB | as accurate as `Q8_0` in our check, 400 MB smaller |
| `Qwen3-ASR-1.7B-Cantonese-HK-Q8_0.gguf` | 1.8 GB | largest |
| `Qwen3-ASR-1.7B-Cantonese-HK.mmproj-Q8_0.gguf` | 356 MB | audio encoder, required with any GGUF above |

SHA-256 values are in the [GGUF model card](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF).

For the 0.6B model, download from `joe2643/Qwen3-ASR-0.6B-Cantonese-HK-GGUF` and replace `1.7B` with `0.6B` in the
file names. `Q4_K_M` with its `mmproj` is about 611 MB in total.

| File | Size | Use |
|---|---:|---|
| `Qwen3-ASR-0.6B-Cantonese-HK.Q4_K_M.gguf` | 397 MB | default, smallest |
| `Qwen3-ASR-0.6B-Cantonese-HK.Q6_K.gguf` | 495 MB | most accurate in our check |
| `Qwen3-ASR-0.6B-Cantonese-HK-Q8_0.gguf` | 639 MB | largest |
| `Qwen3-ASR-0.6B-Cantonese-HK.mmproj-Q8_0.gguf` | 214 MB | audio encoder, required with any 0.6B GGUF above |

SHA-256 values are in the [0.6B GGUF model card](https://huggingface.co/joe2643/Qwen3-ASR-0.6B-Cantonese-HK-GGUF).

#### Hotwords (0.6B)

Put a comma-separated hotword list in a `system` message:

```sh
curl http://127.0.0.1:8180/v1/chat/completions -H "Content-Type: application/json" -d '{
  "messages": [
    {"role": "system", "content": "閂燈, 開燈, 閂冷氣, 較細聲啲"},
    {"role": "user", "content": [{"type": "input_audio",
      "input_audio": {"data": "'"$(base64 -w0 clip.wav)"'", "format": "wav"}}]}
  ],
  "temperature": 0}'
```

## Quick start (Python `transformers` / `vLLM` / ComfyUI)

### `qwen-asr` (`transformers` BF16)

```python
import torch
from qwen_asr import Qwen3ASRModel  # pip install qwen-asr

asr = Qwen3ASRModel.from_pretrained(
    "joe2643/Qwen3-ASR-1.7B-Cantonese-HK",
    dtype=torch.bfloat16,
    device_map="cuda:0",
    max_new_tokens=256,
)
print(asr.transcribe(audio="sample.wav", language="Cantonese")[0].text)
```

For the 0.6B model, use `"joe2643/Qwen3-ASR-0.6B-Cantonese-HK"`. To give it hotwords, pass `context`:

```python
print(asr.transcribe(audio="command.wav", language="Cantonese", context="閂燈, 開燈, 閂冷氣, 較細聲啲")[0].text)
```

### `qwen-asr` (`vLLM` with NVFP4 or FP8)

```python
from qwen_asr import Qwen3ASRModel  # pip install "qwen-asr[vllm]==0.0.6"

asr = Qwen3ASRModel.LLM(
    model="joe2643/Qwen3-ASR-1.7B-Cantonese-HK-NVFP4",  # or -FP8 / BF16 repo
    gpu_memory_utilization=0.5,
    max_model_len=4096,
    max_new_tokens=256,
)
print(asr.transcribe(audio="sample.wav", language="Cantonese")[0].text)
```

### ComfyUI ([ComfyUI-Drama3](https://github.com/PedroMarinhoDev/ComfyUI-Drama3))

```sh
hf download joe2643/Qwen3-ASR-1.7B-Cantonese-HK \
  comfyui/qwen3_asr_1.7b_cantonese_hk_bf16.safetensors --local-dir ComfyUI/models/asr
```

Select `qwen3_asr_1.7b_cantonese_hk_bf16.safetensors` in **Load Qwen3-ASR** and set `language` to `Cantonese`.

## Evaluate on your own clips

```sh
pip install opencc-python-reimplemented
python eval/eval_cer.py my_test.jsonl --out hyp.jsonl
```

`my_test.jsonl` has one clip per line: `{"audio": "clip.wav", "text": "reference transcript"}`. This script does not
normalise numbers, so sets whose references contain digits score a little higher than in the table above.

## Versions

| Version | Date | BF16 revision | GGUF revision | FP8 / NVFP4 |
|---|---|---|---|---|
| **v2 (current)** | 2026-11-10 | `main` | `main` | `main` |
| v1 | 2026-11-07 | [`399c5ef`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK/tree/399c5ef) | [`1afe540`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF/tree/1afe540def044173f7412dc72584f803b92bfa96) | — |

v2 is a second fine-tuning stage on top of v1. `Q4_K_M`, `Q8_0` and `mmproj` keep their file names across versions, so
pin a revision if you need v1. `Q6_K`, `FP8`, `NVFP4`, and the `comfyui/` single-file checkpoint exist for v2.

The table above is for 1.7B. The 0.6B model has one version so far, released 2026-11-13 (BF16 and GGUF, `main`).

## Limitations

- Only Cantonese and Cantonese–English speech were evaluated. Mandarin-only or English-only speech may be worse than the
  stock model.
- Clips up to about 30 seconds were tested. Split longer recordings first.
- Output has punctuation but no timestamps.

## Used by

- [OraType](https://github.com/sennett-lau/oratype): free, open-source voice typing for macOS. It ships the GGUF
  `Q6_K` (v2) with the `mmproj-Q8_0` encoder as its built-in speech model for Cantonese.

## Support

If these Cantonese models save you time or GPU budget, consider buying me a lemon tea (請飲杯檸檬茶) to help fund future open-source Cantonese speech training runs: **[buymeacoffee.com/joe2643](https://buymeacoffee.com/joe2643)** 🍋

## Credits

- Fine-tuning, quantization, and GGUF export: [@joe2643](https://github.com/joe2643)
- Fine-tuning strategy, data collection direction: [@sennett-lau](https://github.com/sennett-lau)

Base models: [Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B) and
[Qwen3-ASR-0.6B](https://huggingface.co/Qwen/Qwen3-ASR-0.6B) by the Qwen team (Apache-2.0).

## License

Apache-2.0, same as the base models.
