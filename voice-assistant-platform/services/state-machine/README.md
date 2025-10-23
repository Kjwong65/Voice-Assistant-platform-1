# State Machine Service - Real-Time Voice Conversation Orchestration

The State Machine service is the **orchestration layer** that coordinates real-time voice conversations by managing states, WebRTC streaming, and coordinating between ASR, LLM, and TTS services.

## 🎯 Features

### Core Capabilities
- **State Management**: Finite state machine for conversation flow control
- **WebRTC Streaming**: Bidirectional real-time audio with low latency
- **Voice Activity Detection (VAD)**: Automatic speech start/end detection
- **Barge-In Support**: User can interrupt assistant mid-speech
- **Session Management**: Multi-tenant session isolation and persistence
- **Event Coordination**: Orchestrates ASR → LLM → TTS pipeline
- **Automatic Recovery**: Handles errors and auto-recovers to idle state

### Conversation States

```
IDLE → LISTENING → TRANSCRIBING → INTERPRETING → ANSWERING → SPEAKING → IDLE
  ↑                                                                        ↓
  └─────────────────────── INTERRUPTED ←──────────────────────────────────┘
```

**State Transitions:**
- `IDLE`: Waiting for user to speak
- `LISTENING`: Capturing user audio
- `TRANSCRIBING`: Processing audio through ASR
- `INTERPRETING`: LLM analyzing transcript + RAG
- `ANSWERING`: Generating response text
- `SPEAKING`: Playing TTS audio to user
- `INTERRUPTED`: User barged in, stopping current response
- `ERROR`: Error state with auto-recovery

## 📁 Architecture

```
state-machine/
├── src/
│   ├── index.ts                 # Main server + event wiring
│   ├── state/
│   │   └── StateMachine.ts      # Core state machine logic
│   ├── handlers/
│   │   ├── WebRTCHandler.ts     # WebRTC + WebSocket management
│   │   └── Orchestrator.ts      # Service coordination (ASR/LLM/TTS)
│   ├── utils/
│   │   └── SessionLogger.ts     # Database persistence
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   └── __tests__/
│       └── StateMachine.test.ts # Unit tests
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL (for session persistence)
- Redis (optional, for distributed state)
- ASR service running on port 5001
- LLM service running on port 5002
- TTS service running on port 5003

### Installation

```bash
cd services/state-machine
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

Key environment variables:
```env
PORT=5005
ASR_SERVICE_URL=http://localhost:5001
LLM_SERVICE_URL=http://localhost:5002
TTS_SERVICE_URL=http://localhost:5003
DATABASE_URL=postgresql://voiceassistant:password@localhost:5432/voice_assistant
VAD_THRESHOLD=0.01
SILENCE_THRESHOLD_MS=1000
```

### Run Development

```bash
npm run dev
```

The service will start on `http://localhost:5005`

### Run Production

```bash
npm run build
npm start
```

## 📡 API Reference

### HTTP Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "state-machine",
  "timestamp": "2025-10-12T04:00:00.000Z",
  "active_sessions": 3,
  "active_connections": 2
}
```

---

#### 2. Create Session
```http
POST /sessions
Content-Type: application/json

{
  "tenantId": "acme-corp",
  "userId": "user-123",
  "voice": "alloy",
  "tone": "friendly",
  "energy": "high",
  "pace": "normal",
  "prosody": "expressive",
  "enableBreaths": true,
  "enableSSML": true,
  "vadSensitivity": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "websocket_url": "ws://localhost:5005/ws/550e8400-e29b-41d4-a716-446655440000",
    "config": {
      "tenantId": "acme-corp",
      "userId": "user-123",
      "voice": "alloy",
      "tone": "friendly",
      ...
    },
    "state": "idle"
  }
}
```

---

#### 3. Get Session Details
```http
GET /sessions/:session_id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "state": "speaking",
    "config": { ... },
    "metrics": {
      "total_turns": 3,
      "total_duration_ms": 45000,
      "avg_latency_ms": 850,
      "interruption_count": 1,
      "error_count": 0
    },
    "conversation_history": [
      {
        "turn_id": "...",
        "user_text": "What is the PTO policy?",
        "assistant_text": "From the Employee Handbook...",
        "citations": [...],
        "latency_ms": 892
      }
    ],
    "is_connected": true
  }
}
```

---

#### 4. End Session
```http
DELETE /sessions/:session_id
```

**Response:**
```json
{
  "success": true,
  "message": "Session ended"
}
```

---

#### 5. Trigger Interrupt
```http
POST /sessions/:session_id/interrupt
```

Immediately stops current TTS playback and returns to listening state.

**Response:**
```json
{
  "success": true,
  "message": "Interrupt signal sent"
}
```

---

#### 6. Get Conversation History
```http
GET /sessions/:session_id/history
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "history": [
      {
        "turn_id": "...",
        "user_text": "What is the PTO policy?",
        "assistant_text": "From the Employee Handbook...",
        "citations": [...],
        "audio_duration_ms": 5000,
        "latency_ms": 892,
        "timestamp": "2025-10-12T04:00:00.000Z"
      }
    ],
    "total_turns": 1
  }
}
```

---

#### 7. List All Sessions
```http
GET /sessions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "session_id": "...",
        "state": "idle",
        "tenant_id": "acme-corp",
        "user_id": "user-123",
        "is_connected": true,
        "created_at": "2025-10-12T04:00:00.000Z",
        "last_activity": "2025-10-12T04:05:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

#### 8. Service Health Check
```http
GET /services/health
```

Checks connectivity to downstream services (ASR, LLM, TTS).

**Response:**
```json
{
  "success": true,
  "data": {
    "asr": "healthy",
    "llm": "healthy",
    "tts": "healthy",
    "all_healthy": true
  }
}
```

---

### WebSocket Protocol

Connect to: `ws://localhost:5005/ws/{session_id}`

#### Client → Server Messages

**1. Signaling (JSON)**
```json
{
  "type": "offer",
  "sdp": "v=0\r\no=- ..."
}
```

```json
{
  "type": "ice-candidate",
  "candidate": "..."
}
```

**2. Control Commands**
```json
{ "type": "start-recording" }
{ "type": "stop-recording" }
{ "type": "interrupt" }
```

**3. Audio Data (Binary)**
Raw PCM audio: 16-bit, 16kHz, mono

---

#### Server → Client Messages

**1. Ready Signal**
```json
{
  "type": "ready",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**2. State Changes**
```json
{
  "type": "state_change",
  "state": "listening",
  "transition": {
    "from": "idle",
    "to": "listening",
    "event": "state_change",
    "timestamp": 1697040000000
  },
  "timestamp": 1697040000000
}
```

**3. Processing Updates**
```json
{
  "type": "llm_thinking",
  "timestamp": 1697040000000
}
```

**4. Audio Data**
```
{JSON header}\n{Binary audio data}
```

JSON header:
```json
{
  "type": "audio",
  "is_final": false,
  "timestamp": 1697040000000
}
```

**5. Stop TTS**
```json
{
  "type": "stop-tts",
  "timestamp": 1697040000000
}
```

---

## 🎯 Usage Examples

### Example 1: Create Session and Connect

```javascript
// Create session
const response = await fetch('http://localhost:5005/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tenantId: 'acme-corp',
    userId: 'user-123',
    voice: 'alloy',
    tone: 'friendly'
  })
});

const { data } = await response.json();
const { session_id, websocket_url } = data;

// Connect WebSocket
const ws = new WebSocket(websocket_url);

ws.onopen = () => {
  console.log('Connected to session:', session_id);
};

ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data);
    console.log('Message:', message.type);
    
    if (message.type === 'state_change') {
      console.log('State:', message.state);
    }
  } catch (e) {
    // Binary audio data
    console.log('Received audio:', event.data.byteLength, 'bytes');
  }
};
```

### Example 2: Send Audio Stream

```javascript
// Get user's microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
    ws.send(event.data); // Send audio chunks
  }
};

mediaRecorder.start(100); // 100ms chunks
```

### Example 3: Interrupt Assistant

```javascript
// Via WebSocket
ws.send(JSON.stringify({ type: 'interrupt' }));

// Via HTTP
await fetch(`http://localhost:5005/sessions/${session_id}/interrupt`, {
  method: 'POST'
});
```

---

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

### Test Coverage

```bash
npm test -- --coverage
```

Target coverage: ≥70% for core modules

### Integration Test

```bash
# Terminal 1: Start all services
cd services/asr && npm run dev &
cd services/llm && npm run dev &
cd services/tts && npm run dev &
cd services/state-machine && npm run dev &

# Terminal 2: Create session
curl -X POST http://localhost:5005/sessions \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"demo","userId":"test"}'

# Note the session_id from response

# Terminal 3: Connect with WebSocket client (wscat)
npm install -g wscat
wscat -c ws://localhost:5005/ws/{session_id}
```

---

## 🔧 Configuration

### VAD (Voice Activity Detection)

Adjust VAD sensitivity in `.env`:

```env
VAD_THRESHOLD=0.01        # Energy threshold (0-1, lower = more sensitive)
SILENCE_THRESHOLD_MS=1000 # Silence duration before VAD end
```

### Session Timeouts

```env
SESSION_TIMEOUT_MS=3600000   # 1 hour
CLEANUP_INTERVAL_MS=300000   # 5 minutes
```

### Service URLs

```env
ASR_SERVICE_URL=http://localhost:5001
LLM_SERVICE_URL=http://localhost:5002
TTS_SERVICE_URL=http://localhost:5003
```

---

## 📊 Monitoring

### Metrics Tracked Per Session

- `total_turns`: Number of completed conversation turns
- `total_duration_ms`: Total session duration
- `avg_latency_ms`: Average response latency (transcription + LLM + TTS)
- `interruption_count`: Number of barge-ins
- `error_count`: Number of errors encountered

### Latency Targets

- **First audio chunk**: < 900ms (best-effort)
- **Barge-in response**: < 200ms
- **VAD detection**: < 50ms

---

## 🐛 Troubleshooting

### Issue: WebSocket connection fails

**Check:**
1. Session exists: `curl http://localhost:5005/sessions/{session_id}`
2. Service is running: `curl http://localhost:5005/health`

### Issue: No audio received

**Check:**
1. WebRTC connection established
2. Client sending audio data (check browser console)
3. VAD threshold not too high: `.env` → `VAD_THRESHOLD=0.005`

### Issue: High latency

**Check:**
1. Downstream services health: `curl http://localhost:5005/services/health`
2. Network latency to OpenAI API
3. Database connection pool size

### Issue: Sessions not cleaning up

**Check:**
1. `SESSION_TIMEOUT_MS` in `.env`
2. Cleanup interval: `CLEANUP_INTERVAL_MS`
3. Database connections

---

## 🏗️ Deployment

### Docker Compose

```yaml
state-machine:
  build: ./services/state-machine
  ports:
    - "5005:5005"
  environment:
    - PORT=5005
    - ASR_SERVICE_URL=http://asr:5001
    - LLM_SERVICE_URL=http://llm:5002
    - TTS_SERVICE_URL=http://tts:5003
    - DATABASE_URL=postgresql://voiceassistant:password@db:5432/voice_assistant
  depends_on:
    - db
    - asr
    - llm
    - tts
```

### Single-Server Deployment

1. **Build**:
```bash
npm run build
```

2. **Start with PM2**:
```bash
pm2 start dist/index.js --name state-machine
pm2 save
pm2 startup
```

3. **Nginx (WebSocket proxy)**:
```nginx
upstream state_machine {
    server localhost:5005;
}

server {
    listen 443 ssl;
    server_name voice.example.com;

    location /ws/ {
        proxy_pass http://state_machine;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://state_machine;
    }
}
```

---

## 🎓 Key Concepts

### State Machine Pattern

The service implements a **Finite State Machine (FSM)** with:
- **States**: Defined set of conversation states
- **Transitions**: Valid state changes
- **Events**: Triggers for state transitions
- **Guards**: Validation rules for transitions

### Event-Driven Architecture

Components communicate via events:
1. **WebRTC Handler** emits user audio and interrupts
2. **Orchestrator** emits service responses
3. **State Machine** coordinates transitions
4. **Events flow bidirectionally** between all components

### Barge-In Logic

When user interrupts:
1. Detect audio during SPEAKING state → trigger interrupt
2. Send `stop_tts` signal to TTS service
3. Transition to INTERRUPTED state
4. Clear pending responses
5. Return to LISTENING after 200ms

---

## 📚 Additional Resources

- [WebRTC Specification](https://webrtc.org/)
- [State Machine Design Pattern](https://en.wikipedia.org/wiki/Finite-state_machine)
- [Voice Activity Detection](https://en.wikipedia.org/wiki/Voice_activity_detection)

---

## 🤝 Contributing

When adding features:
1. Update type definitions in `src/types/`
2. Add state transitions to `StateMachine.ts`
3. Write unit tests with ≥70% coverage
4. Update API documentation in this README

---

**Status**: Phase 5 Complete ✅  
**Next**: Phase 6 - Frontend (Next.js UI with WebRTC widget)
