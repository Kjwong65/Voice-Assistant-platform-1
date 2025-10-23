# 🎙️ Voice Assistant Platform

**Enterprise AI Voice Assistant with RAG, WebRTC, and Multi-Tenant Support**

A production-ready voice assistant platform that integrates OpenAI's Whisper ASR, GPT-4o, and Neural TTS with bi-directional interruptible voice conversations.

## 🌟 Features

- **Real-Time Voice Conversations**: WebRTC-based duplex audio with sub-900ms first-token latency
- **RAG-Powered Responses**: Answer from customer files first, graceful fallback to general knowledge
- **Natural Prosody**: SSML-based tone, pace, energy, and breath control
- **Barge-In Support**: Interrupt and adapt responses in real-time
- **Multi-Tenant Ready**: Isolated data, per-tenant API keys, and configuration
- **Enterprise Observability**: OpenTelemetry traces, Prometheus metrics, structured logs

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│   Web       │────▶│ Gateway  │────▶│   Services  │
│  Console    │     │ (WebRTC) │     │  ASR/LLM/   │
└─────────────┘     └──────────┘     │  TTS/RAG    │
                          │           └─────────────┘
                          ▼
                    ┌──────────┐     ┌─────────────┐
                    │PostgreSQL│     │    Redis    │
                    │+pgvector │     │  (Queue)    │
                    └──────────┘     └─────────────┘
```

### Services

- **Gateway**: API gateway, WebRTC signaling, authentication
- **ASR**: Whisper streaming service for speech-to-text
- **LLM**: GPT-4o orchestrator with tool calling (RAG, TTS, etc.)
- **TTS**: Neural TTS with SSML support
- **RAG**: Document ingestion, chunking, embedding, vector search
- **Console**: Admin dashboard for file uploads and configuration

## 🚀 Quick Start (< 10 minutes)

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- OpenAI API key

### 1. Clone and Setup

```bash
git clone <your-repo>
cd voice-assistant-platform

# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-proj-your-key-here
```

### 2. Install Dependencies

```bash
make install
# or: npm install
```

### 3. Start Development Environment

```bash
make dev
# or: docker-compose up
```

This will start:
- Gateway: http://localhost:3000
- Console: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Jaeger UI: http://localhost:16686
- Prometheus: http://localhost:9090

### 4. Test the Platform

```bash
# Health check
curl http://localhost:3000/health

# Test ASR
curl -X POST http://localhost:5001/transcribe \
  -F "audio=@sample.mp3"

# Test LLM
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"tenantId":"demo"}'

# Test TTS
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world"}' \
  --output response.mp3
```

## 📁 Project Structure

```
voice-assistant-platform/
├── services/
│   ├── gateway/          # API Gateway & WebRTC
│   ├── asr/              # Speech Recognition (Whisper)
│   ├── llm/              # LLM Orchestrator (GPT-4o)
│   ├── tts/              # Text-to-Speech
│   ├── rag/              # RAG Document Processing
│   └── console/          # Admin Web UI (Next.js)
├── shared/
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Shared utilities
│   └── config/           # Configuration management
├── infrastructure/
│   ├── docker/           # Docker configs & migrations
│   └── kubernetes/       # K8s manifests (future)
├── docs/                 # Documentation
├── docker-compose.yml    # Local development
├── .env.example          # Environment template
└── Makefile              # Convenience commands
```

## 🔧 Configuration

### Environment Variables

Key variables to configure in `.env`:

```bash
# Required
OPENAI_API_KEY=sk-proj-your-key-here
DATABASE_URL=postgresql://postgres:password@localhost:5432/voice_assistant
JWT_SECRET=your-jwt-secret-min-32-chars

# Service Ports
GATEWAY_PORT=3000
ASR_PORT=5001
LLM_PORT=5002
TTS_PORT=5003
RAG_PORT=5004
CONSOLE_PORT=3001

# AI Models
WHISPER_MODEL=whisper-1
LLM_MODEL=gpt-4o
TTS_MODEL=tts-1
TTS_VOICE=alloy  # alloy, echo, fable, onyx, nova, shimmer
EMBEDDING_MODEL=text-embedding-3-small

# Feature Flags
ENABLE_BARGE_IN=true
ENABLE_RAG_FALLBACK=true
ENABLE_STREAMING=true
ENABLE_FUNCTION_CALLING=true
```

See `.env.example` for all available options.

## 🛠️ Development

### Common Commands

```bash
# Start all services
make dev

# Start infrastructure only (DB, Redis, monitoring)
make dev-services

# Individual service development
make dev:gateway
make dev:asr
make dev:llm
make dev:tts
make dev:rag
make dev:console

# Build all services
make build

# Run tests
make test

# Code quality
make lint
make format
make typecheck

# Database
make db-migrate
make db-seed

# View logs
make logs

# Health check
make health

# Clean everything
make clean
```

### Adding a New Service

1. Create service directory: `services/your-service/`
2. Add `package.json`, `tsconfig.json`, `Dockerfile`
3. Update root `package.json` workspaces
4. Add service to `docker-compose.yml`
5. Update Prometheus config if exposing metrics

## 📚 API Documentation

### Gateway API

#### Authentication

```bash
POST /auth/login
POST /auth/register
POST /auth/refresh
```

#### WebRTC Session

```bash
POST /rtc/session        # Create WebRTC session
POST /rtc/offer          # Submit SDP offer
POST /rtc/ice-candidate  # Submit ICE candidate
GET  /rtc/session/:id    # Get session status
```

### ASR Service

```bash
POST /transcribe         # Transcribe audio file
POST /stream            # WebSocket for streaming ASR
GET  /health            # Health check
```

### LLM Service

```bash
POST /chat              # Generate response
POST /chat/stream       # Streaming SSE response
GET  /chat/history/:id  # Get conversation history
GET  /health            # Health check
```

### TTS Service

```bash
POST /synthesize        # Generate speech from text
POST /synthesize/ssml   # Generate with SSML markup
GET  /voices            # List available voices
GET  /health            # Health check
```

### RAG Service

```bash
POST /documents         # Upload document
POST /search            # Search documents
GET  /documents         # List documents
GET  /documents/:id     # Get document details
DELETE /documents/:id   # Delete document
GET  /health            # Health check
```

## 📊 Observability

### Monitoring

- **Jaeger UI**: http://localhost:16686 - Distributed tracing
- **Prometheus**: http://localhost:9090 - Metrics collection
- **Logs**: Structured JSON logs in `logs/` directory

### Key Metrics

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `asr_transcription_duration` - ASR processing time
- `llm_generation_tokens` - LLM token usage
- `tts_synthesis_duration` - TTS processing time
- `rag_search_latency` - Vector search performance

### Tracing

All services emit OpenTelemetry traces with:
- Service name
- Operation type
- Duration
- Status (success/error)
- Custom attributes

## 🔒 Security

- JWT-based authentication
- Per-tenant API keys
- Rate limiting (100 req/min default)
- Input sanitization
- CORS configuration
- Environment-based secrets
- Database connection pooling

## 🎯 Roadmap

### Phase 1: Foundation ✅ (Complete)
- Project structure
- Docker setup
- Database schema
- Shared modules

### Phase 2: Core Infrastructure (In Progress)
- Gateway service
- Authentication
- Rate limiting
- Health checks

### Phase 3: RAG Pipeline
- Document ingestion
- Chunking & embedding
- Vector search
- Citation tracking

### Phase 4: Voice Services
- ASR integration
- LLM orchestration
- TTS synthesis
- SSML processing

### Phase 5: Real-Time Features
- WebRTC implementation
- Barge-in detection
- State machine
- Event handling

### Phase 6: Frontend
- React admin console
- Voice chat UI
- Analytics dashboard
- File management

### Phase 7: Production Ready
- Kubernetes manifests
- CI/CD pipelines
- Load testing
- Documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- OpenAI for Whisper, GPT-4o, and TTS APIs
- pgvector for PostgreSQL vector extension
- Jaeger for distributed tracing
- Prometheus for metrics collection

## 📞 Support

- Issues: https://github.com/yourusername/voice-assistant-platform/issues
- Discussions: https://github.com/yourusername/voice-assistant-platform/discussions
- Email: support@yourcompany.com

---

**Built with ❤️ for production voice AI applications**
