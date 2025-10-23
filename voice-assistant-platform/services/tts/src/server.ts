import express, { Request, Response } from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = process.env.PORT || 5003;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// SSML Processor
interface SSMLOptions {
  tone?: 'friendly' | 'professional' | 'formal' | 'casual';
  pace?: 'slow' | 'normal' | 'fast';
  energy?: 'low' | 'medium' | 'high';
}

function processSSML(text: string, options: SSMLOptions = {}): { text: string; speed: number } {
  const { tone = 'professional', pace = 'normal', energy = 'medium' } = options;

  // Add natural breaths
  let processedText = text
    .replace(/\. /g, '. <breath:300ms> ')
    .replace(/, /g, ', <breath:150ms> ');

  // Remove SSML breath tags (OpenAI doesn't support them, but we log for future use)
  processedText = processedText.replace(/<breath:\d+ms>/g, '');

  // Adjust speed based on tone and pace
  let speed = 1.0;

  // Tone adjustments
  if (tone === 'friendly') {
    speed *= 1.05; // Slightly faster
  } else if (tone === 'formal') {
    speed *= 0.90; // Slower
  }

  // Pace adjustments
  if (pace === 'slow') {
    speed *= 0.85;
  } else if (pace === 'fast') {
    speed *= 1.15;
  }

  // Energy adjustments (affects perceived speed)
  if (energy === 'low') {
    speed *= 0.95;
  } else if (energy === 'high') {
    speed *= 1.05;
  }

  // Clamp speed to valid range
  speed = Math.max(0.25, Math.min(4.0, speed));

  return { text: processedText, speed };
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'tts',
    timestamp: new Date().toISOString(),
  });
});

// Synthesize speech
app.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const {
      text,
      voice = process.env.TTS_VOICE || 'alloy',
      model = process.env.TTS_MODEL || 'tts-1',
      tone,
      pace,
      energy,
    } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Text is required',
      });
    }

    console.log(`[TTS] Synthesizing: "${text.substring(0, 100)}..."`);

    // Process SSML options
    const { text: processedText, speed } = processSSML(text, { tone, pace, energy });

    console.log(`[TTS] Voice: ${voice}, Speed: ${speed.toFixed(2)}`);

    // Call OpenAI TTS API
    const mp3 = await openai.audio.speech.create({
      model,
      voice: voice as any,
      input: processedText,
      speed,
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    console.log(`[TTS] Synthesis complete: ${buffer.length} bytes`);

    // Send audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (error: any) {
    console.error('[TTS] Synthesis error:', error);
    res.status(500).json({
      error: 'Synthesis failed',
      message: error.message,
    });
  }
});

// Synthesize with streaming
app.post('/synthesize/stream', async (req: Request, res: Response) => {
  try {
    const {
      text,
      voice = process.env.TTS_VOICE || 'alloy',
      model = process.env.TTS_MODEL || 'tts-1',
      tone,
      pace,
      energy,
    } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Text is required',
      });
    }

    console.log(`[TTS] Streaming synthesis: "${text.substring(0, 100)}..."`);

    const { text: processedText, speed } = processSSML(text, { tone, pace, energy });

    const response = await openai.audio.speech.create({
      model,
      voice: voice as any,
      input: processedText,
      speed,
    });

    // Set headers for streaming
    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
    });

    // Stream the response
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: any) {
    console.error('[TTS] Streaming synthesis error:', error);
    res.status(500).json({
      error: 'Streaming synthesis failed',
      message: error.message,
    });
  }
});

// Get available voices
app.get('/voices', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      voices: [
        {
          id: 'alloy',
          name: 'Alloy',
          description: 'Neutral and balanced',
        },
        {
          id: 'echo',
          name: 'Echo',
          description: 'Warm and friendly',
        },
        {
          id: 'fable',
          name: 'Fable',
          description: 'Expressive and dynamic',
        },
        {
          id: 'onyx',
          name: 'Onyx',
          description: 'Deep and authoritative',
        },
        {
          id: 'nova',
          name: 'Nova',
          description: 'Bright and energetic',
        },
        {
          id: 'shimmer',
          name: 'Shimmer',
          description: 'Soft and soothing',
        },
      ],
      default: 'alloy',
    },
  });
});

// Get SSML options
app.get('/options', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      tones: ['friendly', 'professional', 'formal', 'casual'],
      paces: ['slow', 'normal', 'fast'],
      energies: ['low', 'medium', 'high'],
      defaults: {
        tone: 'professional',
        pace: 'normal',
        energy: 'medium',
      },
    },
  });
});

// Start server
app.listen(port, () => {
  console.log(`[TTS] Service started on port ${port}`);
  console.log(`[TTS] Model: ${process.env.TTS_MODEL || 'tts-1'}`);
  console.log(`[TTS] Default voice: ${process.env.TTS_VOICE || 'alloy'}`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[TTS] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[TTS] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
