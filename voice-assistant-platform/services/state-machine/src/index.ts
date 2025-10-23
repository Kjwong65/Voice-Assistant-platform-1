import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { ConversationStateMachine } from './state/StateMachine';
import { WebRTCHandler } from './handlers/WebRTCHandler';
import { ConversationOrchestrator } from './handlers/Orchestrator';
import {
  SessionConfig,
  EventType,
  ConversationState,
  AudioChunk
} from './types';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Initialize components
const stateMachine = new ConversationStateMachine();
const webrtcHandler = new WebRTCHandler();
const orchestrator = new ConversationOrchestrator();

// Middleware
app.use(cors());
app.use(express.json());

/**
 * HTTP API Routes
 */

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'state-machine',
    timestamp: new Date().toISOString(),
    active_sessions: stateMachine.getActiveSessions().length,
    active_connections: webrtcHandler.getActiveConnections().length
  });
});

// Create new session
app.post('/sessions', async (req: Request, res: Response) => {
  try {
    const config: SessionConfig = {
      tenantId: req.body.tenantId || 'demo',
      userId: req.body.userId || 'user-1',
      voice: req.body.voice || 'alloy',
      tone: req.body.tone,
      energy: req.body.energy,
      pace: req.body.pace,
      prosody: req.body.prosody,
      enableBreaths: req.body.enableBreaths !== false,
      enableSSML: req.body.enableSSML !== false,
      vadSensitivity: req.body.vadSensitivity || 0.5
    };

    const session = stateMachine.createSession(config);

    res.json({
      success: true,
      data: {
        session_id: session.session_id,
        websocket_url: `ws://${req.headers.host}/ws/${session.session_id}`,
        config: session.config,
        state: session.state
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session details
app.get('/sessions/:session_id', (req: Request, res: Response) => {
  const session = stateMachine.getSession(req.params.session_id);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    data: {
      session_id: session.session_id,
      state: session.state,
      config: session.config,
      metrics: session.metrics,
      conversation_history: session.conversation_history,
      is_connected: webrtcHandler.isConnected(session.session_id)
    }
  });
});

// End session
app.delete('/sessions/:session_id', (req: Request, res: Response) => {
  const session_id = req.params.session_id;
  
  // Close WebRTC connection
  webrtcHandler.closeConnection(session_id);
  
  // Delete session
  const deleted = stateMachine.deleteSession(session_id);
  
  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    message: 'Session ended'
  });
});

// Trigger interrupt
app.post('/sessions/:session_id/interrupt', async (req: Request, res: Response) => {
  const session = stateMachine.getSession(req.params.session_id);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  // Trigger interrupt event
  await stateMachine.handleEvent({
    session_id: session.session_id,
    event: EventType.USER_INTERRUPT,
    data: {},
    timestamp: Date.now()
  });

  res.json({
    success: true,
    message: 'Interrupt signal sent'
  });
});

// Get conversation history
app.get('/sessions/:session_id/history', (req: Request, res: Response) => {
  const session = stateMachine.getSession(req.params.session_id);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    data: {
      session_id: session.session_id,
      history: session.conversation_history,
      total_turns: session.metrics.total_turns
    }
  });
});

// List all sessions
app.get('/sessions', (req: Request, res: Response) => {
  const sessions = stateMachine.getActiveSessions();
  
  res.json({
    success: true,
    data: {
      sessions: sessions.map(s => ({
        session_id: s.session_id,
        state: s.state,
        tenant_id: s.config.tenantId,
        user_id: s.config.userId,
        is_connected: webrtcHandler.isConnected(s.session_id),
        created_at: s.created_at,
        last_activity: s.last_activity
      })),
      total: sessions.length
    }
  });
});

// Service health check
app.get('/services/health', async (req: Request, res: Response) => {
  const health = await orchestrator.healthCheck();
  
  res.json({
    success: true,
    data: {
      asr: health.asr ? 'healthy' : 'unavailable',
      llm: health.llm ? 'healthy' : 'unavailable',
      tts: health.tts ? 'healthy' : 'unavailable',
      all_healthy: health.asr && health.llm && health.tts
    }
  });
});

/**
 * WebSocket Handler
 */
wss.on('connection', (ws: WebSocket, req) => {
  // Extract session_id from URL: /ws/{session_id}
  const pathParts = req.url?.split('/');
  const session_id = pathParts?.[2];

  if (!session_id) {
    ws.close(1008, 'Invalid session ID');
    return;
  }

  const session = stateMachine.getSession(session_id);
  if (!session) {
    ws.close(1008, 'Session not found');
    return;
  }

  console.log(`[WebSocket] New connection for session ${session_id}`);

  // Set up WebRTC handler
  webrtcHandler.handleConnection(ws, session_id);
});

/**
 * Event Coordination
 * Wire up events between components
 */

// WebRTC → State Machine
webrtcHandler.on(EventType.VAD_START, async (data) => {
  await stateMachine.handleEvent({
    ...data,
    event: EventType.VAD_START,
    timestamp: Date.now()
  });
});

webrtcHandler.on(EventType.VAD_END, async (data) => {
  const session = stateMachine.getSession(data.session_id);
  if (!session) return;

  await stateMachine.handleEvent({
    ...data,
    event: EventType.VAD_END,
    timestamp: Date.now()
  });

  // Process turn if we have audio
  if (session.audio_buffer.length > 0) {
    await orchestrator.processTurn(session, session.audio_buffer);
  }
});

webrtcHandler.on(EventType.USER_AUDIO, async (data) => {
  await stateMachine.handleEvent({
    ...data,
    event: EventType.USER_AUDIO,
    timestamp: Date.now()
  });
});

webrtcHandler.on('user_interrupt', async (data) => {
  await stateMachine.handleEvent({
    ...data,
    event: EventType.USER_INTERRUPT,
    timestamp: Date.now()
  });
});

webrtcHandler.on('disconnected', (data) => {
  // Clean up session after a delay
  setTimeout(() => {
    stateMachine.deleteSession(data.session_id);
  }, 5000);
});

// Orchestrator → State Machine
orchestrator.on(EventType.TRANSCRIPTION_FINAL, async (data) => {
  await stateMachine.handleEvent({
    session_id: data.session_id,
    event: EventType.TRANSCRIPTION_FINAL,
    data: data.result,
    timestamp: Date.now()
  });
});

orchestrator.on(EventType.LLM_RESPONSE_COMPLETE, async (data) => {
  await stateMachine.handleEvent({
    session_id: data.session_id,
    event: EventType.LLM_RESPONSE_COMPLETE,
    data: data.response,
    timestamp: Date.now()
  });
});

orchestrator.on(EventType.TTS_START, async (data) => {
  await stateMachine.handleEvent({
    session_id: data.session_id,
    event: EventType.TTS_START,
    data: { stream_id: data.stream_id },
    timestamp: Date.now()
  });
});

orchestrator.on(EventType.TTS_COMPLETE, async (data) => {
  const session = stateMachine.getSession(data.session_id);
  if (!session) return;

  // Send audio to client
  if (data.audio) {
    webrtcHandler.sendAudio(data.session_id, data.audio, true);
  }

  await stateMachine.handleEvent({
    session_id: data.session_id,
    event: EventType.TTS_COMPLETE,
    data: {},
    timestamp: Date.now()
  });
});

orchestrator.on(EventType.ERROR, async (data) => {
  await stateMachine.handleEvent({
    session_id: data.session_id,
    event: EventType.ERROR,
    data: data.error,
    timestamp: Date.now()
  });
});

// State Machine → WebRTC
stateMachine.on('stop_tts', (data) => {
  webrtcHandler.stopTTS(data.session_id);
  orchestrator.stopTTS(data.session_id, data.stream_id);
});

stateMachine.on(EventType.STATE_CHANGE, (data) => {
  // Send state updates to client
  webrtcHandler.sendMessage(data.session_id, {
    type: 'state_change',
    state: data.session.state,
    transition: data.transition,
    timestamp: Date.now()
  });
});

// Orchestrator → WebRTC (streaming updates)
orchestrator.on(EventType.LLM_THINKING, (data) => {
  webrtcHandler.sendMessage(data.session_id, {
    type: 'llm_thinking',
    timestamp: Date.now()
  });
});

orchestrator.on(EventType.TTS_CHUNK, (data) => {
  if (data.audio) {
    webrtcHandler.sendAudio(data.session_id, data.audio, data.is_final);
  }
});

/**
 * Cleanup Task
 * Remove stale sessions every 5 minutes
 */
setInterval(() => {
  const cleaned = stateMachine.cleanupStaleSessions(3600000); // 1 hour
  if (cleaned > 0) {
    console.log(`[Cleanup] Removed ${cleaned} stale sessions`);
  }
}, 300000);

/**
 * Start Server
 */
const PORT = parseInt(process.env.PORT || '5005');

httpServer.listen(PORT, () => {
  console.log(`[State Machine] Server running on port ${PORT}`);
  console.log(`[State Machine] WebSocket endpoint: ws://localhost:${PORT}/ws/{session_id}`);
  console.log(`[State Machine] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[State Machine] SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[State Machine] Server closed');
    process.exit(0);
  });
});
