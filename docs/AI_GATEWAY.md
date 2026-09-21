# MoneyPath AI gateway

Ask MoneyPath selects one per-user provider in **AI Mode**. The provider receives the same structured request; MoneyPath calculations remain the source of all balances, debts, spending, goals and safe-to-spend values.

## Providers

- **Ollama** is the default local provider.
- **GPT-OSS-20B Local** calls a separate OpenAI-compatible service at `GPT_OSS_BASE_URL`. The optional Compose profile runs vLLM with the official `openai/gpt-oss-20b` Hugging Face model. Its persistent Hugging Face cache is mounted read-only from the application's perspective; MoneyPath never edits model files.
- **OpenAI API** is opt-in. AI Mode warns that relevant financial context leaves the local server. The API key is encrypted at rest and is never returned to the browser.

Start GPT-OSS only on a host with a supported GPU and at least 16 GB available model memory:

```sh
docker compose --profile gpt-oss up -d gpt-oss
```

The current small test VM is below the official memory target, so keep Ollama active there. You can point the GPT-OSS endpoint at a larger machine on the same private network without changing MoneyPath.

## Memory and privacy

Recent encrypted chat messages provide short-term context. Long-term memory stores encrypted user preferences and retrieves only lexical matches for the current question. The memory API rejects numbers and financial-record terms. Live financial values always come from MoneyPath records and deterministic calculations.

## Voice boundary

Voice must feed the existing `/api/chat` route so text and voice share one AI gateway, finance tools, confirmation workflow and memory. Run wake word, VAD, Whisper-compatible STT and TTS as separate local services. Do not expose those services publicly and do not route them through Alexa or Amazon cloud APIs.
