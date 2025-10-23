import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'console',
    timestamp: new Date().toISOString(),
  });
});

// Console home
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Voice Assistant Console</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 800px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
          color: #667eea;
          margin-bottom: 10px;
          font-size: 2.5em;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 1.1em;
        }
        .status {
          background: #f0f7ff;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
        }
        .status h3 {
          color: #667eea;
          margin-bottom: 15px;
        }
        .services {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
        .service {
          background: white;
          padding: 15px;
          border-radius: 8px;
          border: 2px solid #e0e0e0;
        }
        .service.healthy { border-color: #4caf50; }
        .service h4 {
          color: #333;
          margin-bottom: 5px;
        }
        .service p {
          color: #666;
          font-size: 0.9em;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85em;
          font-weight: 600;
          margin-top: 8px;
        }
        .badge.healthy {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .actions {
          margin-top: 30px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
        }
        .action-card {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .action-card h4 {
          color: #667eea;
          margin-bottom: 8px;
        }
        .action-card p {
          color: #666;
          font-size: 0.9em;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
          color: #999;
          font-size: 0.9em;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎙️ Voice Assistant Console</h1>
        <p class="subtitle">Admin Dashboard for AI Voice Assistant Platform</p>

        <div class="status">
          <h3>System Status</h3>
          <div class="services">
            <div class="service healthy">
              <h4>🎤 ASR Service</h4>
              <p>Speech Recognition</p>
              <span class="badge healthy">Healthy</span>
            </div>
            <div class="service healthy">
              <h4>🤖 LLM Service</h4>
              <p>AI Orchestrator</p>
              <span class="badge healthy">Healthy</span>
            </div>
            <div class="service healthy">
              <h4>🔊 TTS Service</h4>
              <p>Text-to-Speech</p>
              <span class="badge healthy">Healthy</span>
            </div>
            <div class="service healthy">
              <h4>📚 RAG Service</h4>
              <p>Knowledge Base</p>
              <span class="badge healthy">Healthy</span>
            </div>
          </div>
        </div>

        <h3 style="margin-top: 30px; color: #333;">Quick Actions</h3>
        <div class="actions">
          <div class="action-card" onclick="window.open('http://localhost:16686', '_blank')">
            <h4>📊 View Traces</h4>
            <p>Jaeger distributed tracing</p>
          </div>
          <div class="action-card" onclick="window.open('http://localhost:9090', '_blank')">
            <h4>📈 View Metrics</h4>
            <p>Prometheus monitoring</p>
          </div>
          <div class="action-card" onclick="alert('Upload documents via /api/ingest endpoint')">
            <h4>📤 Upload Docs</h4>
            <p>Add to knowledge base</p>
          </div>
          <div class="action-card" onclick="alert('Use /api/chat endpoint to test')">
            <h4>💬 Test Chat</h4>
            <p>Try the AI assistant</p>
          </div>
        </div>

        <div class="footer">
          <p><strong>Gateway:</strong> http://localhost:3000 | <strong>API Docs:</strong> See README.md</p>
          <p style="margin-top: 8px;">View logs: <code>docker-compose logs -f</code></p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`[Console] Service started on port ${port}`);
  console.log(`[Console] Open http://localhost:${port} in your browser`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[Console] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Console] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
