# ⚡ Quick Reference - Voice Assistant Platform

## 🚀 Start in 3 Commands

```bash
# 1. Setup
cp .env.example .env && nano .env  # Add your OpenAI API key

# 2. Start
make dev  # or: docker-compose up

# 3. Test
curl http://localhost:3000/api/status
```

## 📍 Service Endpoints

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Gateway | 3000 | http://localhost:3000 | API Gateway |
| Console | 3001 | http://localhost:3001 | Admin UI |
| ASR | 5001 | http://localhost:5001 | Speech→Text |
| LLM | 5002 | http://localhost:5002 | AI Chat |
| TTS | 5003 | http://localhost:5003 | Text→Speech |
| RAG | 5004 | http://localhost:5004 | Doc Search |
| Jaeger | 16686 | http://localhost:16686 | Traces |
| Prometheus | 9090 | http://localhost:9090 | Metrics |

## 🧪 Quick Tests

### Test ASR (Speech Recognition)
```bash
curl -X POST http://localhost:5001/transcribe -F "audio=@test.mp3"
```

### Test LLM (Chat)
```bash
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"tenantId":"demo"}'
```

### Test TTS (Text-to-Speech)
```bash
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"alloy"}' \
  --output test.mp3
```

### Test RAG (Document Upload)
```bash
echo "Test document content" > test.txt
curl -X POST http://localhost:5004/ingest \
  -F "file=@test.txt" \
  -F "tenantId=demo"
```

### Test RAG (Search)
```bash
curl -X POST http://localhost:5004/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","tenant_id":"demo"}'
```

## 📋 Common Commands

```bash
# Start services
make dev

# Stop services  
make down

# Clean everything
make clean

# View logs
make logs

# Rebuild
make dev-build
```

## 🎯 TTS Voice Options

- `alloy` - Neutral, balanced
- `echo` - Warm, friendly  
- `fable` - Expressive, dynamic
- `onyx` - Deep, authoritative
- `nova` - Bright, energetic
- `shimmer` - Soft, soothing

## 🎨 TTS Prosody

**Tones**: `friendly`, `professional`, `formal`, `casual`  
**Pace**: `slow`, `normal`, `fast`  
**Energy**: `low`, `medium`, `high`

Example:
```bash
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text":"Welcome to the platform",
    "voice":"nova",
    "tone":"friendly",
    "pace":"fast",
    "energy":"high"
  }' --output welcome.mp3
```

## 🔍 Troubleshooting

**Services won't start?**
```bash
make clean && make dev-build
```

**Database issues?**
```bash
docker-compose restart postgres
```

**Check service health:**
```bash
curl http://localhost:3000/api/status
```

**View specific logs:**
```bash
docker-compose logs -f llm
```

## 📊 Project Stats

- **Services**: 6 microservices
- **Files**: 40+ TypeScript/Config files
- **Lines of Code**: 5,000+
- **Tech Stack**: Node.js, TypeScript, PostgreSQL, Redis, Docker
- **APIs**: OpenAI GPT-4o, Whisper, TTS

## 📚 More Info

- **Setup**: See [GETTING_STARTED.md](GETTING_STARTED.md)
- **Architecture**: See [README.md](README.md)  
- **Details**: See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

## ⚡ End-to-End Flow

```bash
# Full conversation pipeline
TEXT=$(curl -s -X POST http://localhost:5001/transcribe -F "audio=@q.mp3" | jq -r '.data.text')
ANSWER=$(curl -s -X POST http://localhost:5002/chat -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$TEXT\"}],\"tenantId\":\"demo\"}" | jq -r '.data.response')
curl -X POST http://localhost:5003/synthesize -H "Content-Type: application/json" -d "{\"text\":\"$ANSWER\"}" --output answer.mp3
```

---

**Happy coding! 🎉**
