import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

// Service URLs
const ASR_URL = process.env.ASR_SERVICE_URL || 'http://asr:5001';
const LLM_URL = process.env.LLM_SERVICE_URL || 'http://llm:5002';
const TTS_URL = process.env.TTS_SERVICE_URL || 'http://tts:5003';
const RAG_URL = process.env.RAG_SERVICE_URL || 'http://rag:5004';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'gateway',
    timestamp: new Date().toISOString(),
  });
});

// Gateway status - check all services
app.get('/api/status', async (req: Request, res: Response) => {
  try {
    const services = ['asr', 'llm', 'tts', 'rag'];
    const urls = [ASR_URL, LLM_URL, TTS_URL, RAG_URL];

    const checks = await Promise.allSettled(
      urls.map((url) => axios.get(`${url}/health`, { timeout: 5000 }))
    );

    const status = services.reduce((acc, service, index) => {
      acc[service] = checks[index].status === 'fulfilled' ? 'healthy' : 'unhealthy';
      return acc;
    }, {} as Record<string, string>);

    const allHealthy = Object.values(status).every((s) => s === 'healthy');

    res.json({
      status: allHealthy ? 'healthy' : 'degraded',
      services: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
    });
  }
});

// Proxy to ASR service
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${ASR_URL}/transcribe`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Transcription failed',
      message: error.message,
    });
  }
});

// Proxy to LLM service
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${LLM_URL}/chat`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Chat failed',
      message: error.message,
    });
  }
});

// Get chat history
app.get('/api/chat/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${LLM_URL}/chat/history/${req.params.sessionId}`);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to get history',
      message: error.message,
    });
  }
});

// Proxy to TTS service
app.post('/api/synthesize', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${TTS_URL}/synthesize`, req.body, {
      responseType: 'arraybuffer',
    });
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Synthesis failed',
      message: error.message,
    });
  }
});

// Get TTS voices
app.get('/api/voices', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${TTS_URL}/voices`);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to get voices',
      message: error.message,
    });
  }
});

// Proxy to RAG service - Ingest document
app.post('/api/ingest', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${RAG_URL}/ingest`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Ingestion failed',
      message: error.message,
    });
  }
});

// Search knowledge base
app.post('/api/search', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${RAG_URL}/search`, req.body);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
});

// Get documents
app.get('/api/documents', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${RAG_URL}/documents`, {
      params: req.query,
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to get documents',
      message: error.message,
    });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req: Request, res: Response) => {
  try {
    const response = await axios.delete(`${RAG_URL}/documents/${req.params.id}`);
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to delete document',
      message: error.message,
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[Gateway] Service started on port ${port}`);
  console.log(`[Gateway] ASR: ${ASR_URL}`);
  console.log(`[Gateway] LLM: ${LLM_URL}`);
  console.log(`[Gateway] TTS: ${TTS_URL}`);
  console.log(`[Gateway] RAG: ${RAG_URL}`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[Gateway] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Gateway] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
