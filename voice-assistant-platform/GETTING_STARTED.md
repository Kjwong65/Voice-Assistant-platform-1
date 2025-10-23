# 🚀 Getting Started with Voice Assistant Platform

This guide will walk you through setting up and testing the AI Voice Assistant Platform in under 10 minutes.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Docker Desktop** (or Docker + Docker Compose)
- **Node.js 20+** (for local development)
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **Terminal/Command Line** access

## 🔧 Step 1: Initial Setup

### 1.1 Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
nano .env  # or use any text editor
```

**Important**: Replace `sk-proj-your-key-here` with your actual OpenAI API key in the `.env` file:

```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

### 1.2 Install Dependencies (Optional for local development)

```bash
npm install
```

## 🐳 Step 2: Start the Platform

### 2.1 Start All Services with Docker

```bash
# Using Make (recommended)
make dev

# Or using Docker Compose directly
docker-compose up
```

This will start:
- ✅ Gateway (Port 3000)
- ✅ Console (Port 3001)
- ✅ ASR Service (Port 5001)
- ✅ LLM Service (Port 5002)
- ✅ TTS Service (Port 5003)
- ✅ RAG Service (Port 5004)
- ✅ PostgreSQL (Port 5432)
- ✅ Redis (Port 6379)
- ✅ Jaeger UI (Port 16686)
- ✅ Prometheus (Port 9090)

### 2.2 Wait for Services to Start

Watch the terminal output. You should see messages like:
```
[Gateway] Service started on port 3000
[ASR] Service started on port 5001
[LLM] Service started on port 5002
[TTS] Service started on port 5003
[RAG] Service started on port 5004
```

This usually takes 30-60 seconds on first run.

## 🧪 Step 3: Test the Services

### 3.1 Check Service Health

```bash
# Check if all services are healthy
curl http://localhost:3000/api/status
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "asr": "healthy",
    "llm": "healthy",
    "tts": "healthy",
    "rag": "healthy"
  }
}
```

### 3.2 Test Speech Recognition (ASR)

Create a test audio file or use an existing one:

```bash
# Test transcription
curl -X POST http://localhost:5001/transcribe \
  -F "audio=@your-audio-file.mp3"
```

Example response:
```json
{
  "success": true,
  "data": {
    "text": "Hello, how are you today?",
    "language": "en",
    "duration": 2.5
  }
}
```

### 3.3 Test Chat (LLM)

```bash
# Ask a simple question
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "tenantId": "demo"
  }'
```

Example response:
```json
{
  "success": true,
  "data": {
    "response": "The capital of France is Paris.",
    "sessionId": "session-1234567890",
    "usage": {
      "prompt_tokens": 15,
      "completion_tokens": 8,
      "total_tokens": 23
    }
  }
}
```

### 3.4 Test Text-to-Speech (TTS)

```bash
# Generate speech from text
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello! Welcome to the AI voice assistant platform.",
    "voice": "alloy",
    "tone": "friendly"
  }' \
  --output test-output.mp3
```

Then play the audio file:
```bash
# On macOS
open test-output.mp3

# On Linux
xdg-open test-output.mp3

# On Windows
start test-output.mp3
```

### 3.5 Test RAG (Document Search)

#### Upload a Document

Create a simple test document:
```bash
echo "The company's PTO policy allows 20 days of paid time off per year." > test-policy.txt

# Upload it
curl -X POST http://localhost:5004/ingest \
  -F "file=@test-policy.txt" \
  -F "tenantId=demo"
```

#### Search the Knowledge Base

```bash
curl -X POST http://localhost:5004/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many PTO days do employees get?",
    "tenant_id": "demo"
  }'
```

Example response:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "content": "The company's PTO policy allows 20 days of paid time off per year.",
        "similarity": 0.89,
        "filename": "test-policy.txt"
      }
    ]
  }
}
```

## 🎯 Step 4: End-to-End Test

Test the complete voice assistant flow:

```bash
# 1. Record or use a test audio file with a question
# For this example, assume you have question.mp3 that says "What's the PTO policy?"

# 2. Transcribe the audio
TEXT=$(curl -s -X POST http://localhost:5001/transcribe \
  -F "audio=@question.mp3" | jq -r '.data.text')

echo "Transcribed: $TEXT"

# 3. Get LLM response (with RAG)
RESPONSE=$(curl -s -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$TEXT\"}],\"tenantId\":\"demo\"}" \
  | jq -r '.data.response')

echo "LLM Response: $RESPONSE"

# 4. Generate speech from response
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$RESPONSE\",\"voice\":\"alloy\",\"tone\":\"professional\"}" \
  --output answer.mp3

echo "Answer generated: answer.mp3"
```

## 📊 Step 5: Monitor the Platform

### Jaeger (Distributed Tracing)

Open http://localhost:16686 in your browser to view request traces across all services.

### Prometheus (Metrics)

Open http://localhost:9090 to view metrics and performance data.

### Service Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f llm

# View last 100 lines
docker-compose logs --tail=100 asr
```

## 🎨 Step 6: Use the Platform

### Common Use Cases

#### 1. Ask Questions with RAG

```bash
# Upload company documents
curl -X POST http://localhost:5004/ingest \
  -F "file=@handbook.pdf" \
  -F "tenantId=demo"

# Ask questions
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is our remote work policy?"}
    ],
    "tenantId": "demo"
  }'
```

#### 2. Multi-Turn Conversations

```bash
# Start a conversation
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me about AI"}
    ],
    "sessionId": "my-session-123",
    "tenantId": "demo"
  }'

# Continue the conversation
curl -X POST http://localhost:5002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me about AI"},
      {"role": "assistant", "content": "..."},
      {"role": "user", "content": "Can you explain that in simpler terms?"}
    ],
    "sessionId": "my-session-123",
    "tenantId": "demo"
  }'
```

#### 3. Different TTS Voices and Tones

```bash
# Professional tone
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Good morning. Here is your briefing.",
    "voice": "onyx",
    "tone": "professional",
    "pace": "normal"
  }' \
  --output professional.mp3

# Friendly tone
curl -X POST http://localhost:5003/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hey! Great to see you!",
    "voice": "nova",
    "tone": "friendly",
    "pace": "fast",
    "energy": "high"
  }' \
  --output friendly.mp3
```

## 🛠️ Troubleshooting

### Services Not Starting

```bash
# Check Docker is running
docker ps

# Restart services
make down
make dev

# Rebuild from scratch
make clean
make dev-build
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### OpenAI API Errors

1. Verify your API key is set correctly in `.env`
2. Check you have credits: https://platform.openai.com/usage
3. Verify billing is active: https://platform.openai.com/account/billing

### Out of Memory Errors

```bash
# Increase Docker memory limit in Docker Desktop settings
# Recommended: 4GB minimum, 8GB for best performance
```

## 🧹 Cleanup

### Stop Services

```bash
# Stop but keep data
make down

# Stop and remove all data
make clean
```

### Remove Everything

```bash
# Remove all containers, volumes, and images
docker-compose down -v --rmi all
```

## 📚 Next Steps

1. **Read the [README.md](README.md)** for detailed architecture information
2. **Explore the [API Documentation](#)** for advanced features
3. **Upload your own documents** to test RAG capabilities
4. **Customize system prompts** in the database for different use cases
5. **Monitor performance** using Jaeger and Prometheus

## 🆘 Getting Help

- Check the logs: `docker-compose logs -f`
- Review service health: `curl http://localhost:3000/api/status`
- Open an issue on GitHub
- Check the documentation

## 🎉 Success!

You now have a fully functional AI Voice Assistant Platform running locally! 

The platform can:
- ✅ Transcribe speech to text
- ✅ Process questions with GPT-4o
- ✅ Search your documents with RAG
- ✅ Generate natural-sounding speech
- ✅ Track conversations
- ✅ Handle multiple tenants

Happy building! 🚀
