# Qwen3-ASR-1.7B Cantonese (Hong Kong)

A fine-tune of [`Qwen/Qwen3-ASR-1.7B`](https://huggingface.co/Qwen/Qwen3-ASR-1.7B) for **Hong Kong colloquial Cantonese
with English code-switching**. It writes Hong Kong Traditional Chinese with the characters people actually use when
they speak (`係`, `喺`, `嘅`, `咗`, `㗎`, `撚`, `屌`), keeps English words in English, and avoids the Simplified or
Mainland-style output of the stock model.

**Weights:** [joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF)
(GGUF for `llama.cpp`, used by [OraType](https://github.com/sennett-lau/oratype)).

## Benchmark

Character error rate, greedy decoding, BF16 `transformers`, language forced to Cantonese. Before scoring, text is
converted to Simplified (OpenCC `t2s`), numbers are normalised and spaces removed.

| Test set | Stock `Qwen3-ASR-1.7B` | v1 | **v2 (current)** | `whisper-large-v3` |
|---|---:|---:|---:|---:|
| FLEURS (`yue_hant_hk`) | 4.20% | 4.00% | **3.95%** | 20.97% |
| Common Voice `yue` | 5.46% | **3.80%** | 3.86% | 36.44% |
| Common Voice 23 `zh-HK` | 7.65% | 5.18% | **5.09%** | 41.76% |
| MDCC | 4.25% | 2.53% | **2.49%** | 34.52% |
| LegCo (HK Legislative Council) | 7.22% | 7.17% | **7.16%** | 32.15% |
| MCE (Cantonese–English code-switching) | 11.74% | **5.61%** | 5.62% | 24.00% |

The GGUF files were checked separately with `llama-server` on 60 test clips: Q4_K_M and Q8_0 both transcribe
correctly, Q8_0 slightly better.

## Quick start (llama.cpp)

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
On a Ryzen AI Max+ 395 with a CPU-only build, Q4_K_M takes about 0.45 s for a 3 s clip.

| File | Size | Use |
|---|---:|---|
| `Qwen3-ASR-1.7B-Cantonese-HK.Q4_K_M.gguf` | 1.1 GB | default, fastest |
| `Qwen3-ASR-1.7B-Cantonese-HK.Q6_K.gguf` | 1.4 GB | as accurate as Q8_0 in our check, 400 MB smaller |
| `Qwen3-ASR-1.7B-Cantonese-HK-Q8_0.gguf` | 1.8 GB | largest |
| `Qwen3-ASR-1.7B-Cantonese-HK.mmproj-Q8_0.gguf` | 356 MB | audio encoder, needed with either |

SHA-256 values are in the [model card](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF).

## Evaluate on your own clips

```sh
pip install opencc-python-reimplemented
python eval/eval_cer.py my_test.jsonl --out hyp.jsonl
```

`my_test.jsonl` has one clip per line: `{"audio": "clip.wav", "text": "reference transcript"}`. This script does not
normalise numbers, so sets whose references contain digits score a little higher than in the table above.

## Versions

| Version | Date | GGUF revision |
|---|---|---|
| v2 | 2026-11-10 | `main` |
| v1 | 2026-11-07 | [`1afe540`](https://huggingface.co/joe2643/Qwen3-ASR-1.7B-Cantonese-HK-GGUF/tree/1afe540def044173f7412dc72584f803b92bfa96) |

v2 is a second fine-tuning stage on top of v1. File names are the same, so pin a revision if you need v1.

## Limitations

- Only Cantonese and Cantonese–English speech were evaluated. Mandarin-only or English-only speech may be worse than the
  stock model.
- Clips up to about 30 seconds were tested. Split longer recordings first.
- Output has punctuation but no timestamps.

## Credits

- Fine-tuning and GGUF export: [@joe2643](https://github.com/joe2643)
- Testing and [OraType](https://github.com/sennett-lau/oratype) integration: [@sennett-lau](https://github.com/sennett-lau)

Base model: [Qwen3-ASR](https://huggingface.co/Qwen/Qwen3-ASR-1.7B) by the Qwen team (Apache-2.0).

## License

Apache-2.0, same as the base model.
