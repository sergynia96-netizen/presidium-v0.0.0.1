# presidium-v0.0.0.1
Unified messaging platform. Email + SMS + P2P. Quantum-ready PQC encryption. CRDT offline-first. AI-powered chat with emotion detection.

## Local LLM chat
Backend supports an OpenAI-compatible local LLM endpoint. Set the URL and model in `.env`:

```bash
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3
LOCAL_LLM_API_KEY=
VITE_API_BASE_URL=http://localhost:3000
```

If unset, the API returns a local stub response.

## Audio & video calls (demo)
The frontend includes a WebRTC loopback demo for audio and video calls. It is single-device only and uses a local peer connection to validate media capture. For real multi-user calls you will need a signaling server plus STUN/TURN configuration.
