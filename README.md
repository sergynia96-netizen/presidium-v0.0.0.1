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
The frontend includes WebRTC audio/video calls with a simple REST-based signaling queue. Open the app in two tabs, connect to the same room, and start an audio/video call. For production multi-user calls you will need a real-time signaling server plus STUN/TURN configuration.
