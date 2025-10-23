# 🚀 Quick Start Guide - Phase 1

## What You Have

Phase 1 (Foundation) of your Voice Assistant Platform is complete! You have:

✅ Complete project structure with 6 service directories
✅ PostgreSQL + pgvector database schema
✅ Docker Compose orchestration
✅ Shared TypeScript types, utils, and config
✅ Development tooling (ESLint, Prettier, TypeScript)
✅ Makefile with convenience commands
✅ Comprehensive documentation

## 🎯 Next Steps (5 Minutes to Running)

### 1. Extract the Files

Download and extract `voice-assistant-platform.zip` to your desired location.

### 2. Set Up Environment

```bash
cd voice-assistant-platform

# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
nano .env  # or use your favorite editor

# Required: Add this line
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### 3. Install Dependencies

```bash
# Install all project dependencies
npm install

# This will install for all workspaces (services + shared modules)
```

### 4. Start Infrastructure

```bash
# Start PostgreSQL, Redis, Jaeger, and Prometheus
docker-compose up -d postgres redis jaeger prometheus

# Wait ~30 seconds for services to be ready
```

### 5. Verify Everything Works

```bash
# Check database
docker-compose exec postgres psql -U postgres -d voice_assistant -c "\dt"

# You should see 9 tables listed

# Check Redis
docker-compose exec redis redis-cli ping

# You should see "PONG"

# View logs
docker-compose logs
```

## 🎉 You're Ready!

Your foundation is set up! Here's what's running:

- **PostgreSQL + pgvector**: localhost:5432
- **Redis**: localhost:6379
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090

## 📂 Project Structure

```
voice-assistant-platform/
├── services/          # Future: ASR, LLM, TTS, RAG, Gateway, Console
├── shared/           # Types, Utils, Config (ready to use)
├── infrastructure/   # Docker configs & DB migrations
├── docs/            # Documentation
├── .env.example     # Environment template
├── docker-compose.yml
├── Makefile
└── README.md
```

## 🔧 Useful Commands

```bash
# View all services
docker-compose ps

# Stop everything
docker-compose down

# Start with logs visible
docker-compose up postgres redis jaeger prometheus

# Clean everything (including data)
docker-compose down -v

# Check health
make health

# View logs
make logs
```

## 📖 What's in Phase 1?

### Database Tables Created
- `tenants` - Multi-tenant support
- `users` - User management
- `sessions` - Conversation sessions
- `conversations` - Message history
- `documents` - Uploaded files
- `document_chunks` - Vector embeddings for RAG
- `analytics` - Event tracking
- `api_usage` - Billing/monitoring

### Shared Modules Ready
- **@shared/types**: 50+ TypeScript interfaces
- **@shared/utils**: Logger, error handlers, utilities
- **@shared/config**: Environment configuration

### Docker Services Configured
- PostgreSQL with pgvector extension
- Redis for caching/queuing
- Jaeger for distributed tracing
- Prometheus for metrics

## 🚀 Ready for Phase 2?

Phase 2 will build:
- **Gateway Service** - API gateway with authentication
- **Health Check Endpoints** - Service monitoring
- **JWT Authentication** - Secure API access
- **Rate Limiting** - Request throttling
- **Basic WebRTC Setup** - Signaling foundation

When ready, just say: **"Start Phase 2"**

## 🆘 Troubleshooting

### Database won't start
```bash
# Check if port 5432 is already in use
lsof -i :5432

# If something else is using it, stop that service or change the port
```

### Redis connection issues
```bash
# Check Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### Can't connect to database
```bash
# Make sure services are running
docker-compose ps

# Check database logs
docker-compose logs postgres
```

### Permission errors
```bash
# On Linux/Mac, you might need to fix permissions
sudo chown -R $USER:$USER .
```

## 💡 Tips

1. **Keep .env secure** - Never commit it to Git
2. **Use Docker volumes** - Data persists between restarts
3. **Check logs first** - Most issues show up in logs
4. **One service at a time** - When building Phase 2+
5. **Test incrementally** - Verify each service works before moving on

## 📞 What's Next?

You have the foundation! The next phases will add:

- **Phase 2**: Gateway service with authentication
- **Phase 3**: RAG pipeline for document search
- **Phase 4**: Voice services (ASR, LLM, TTS)
- **Phase 5**: Real-time WebRTC features
- **Phase 6**: Admin console UI
- **Phase 7**: Production deployment

Each phase builds on the previous one, creating a complete voice AI platform!

---

**Status**: Phase 1 Complete ✅
**Time to Complete Phase 1**: ~2 hours
**Next Phase Duration**: ~2-3 hours
**Total Project Duration**: ~15-20 hours

Happy building! 🎙️
