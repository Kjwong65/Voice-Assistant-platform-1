import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 5001;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/m4a',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg',
      'video/webm',
      'video/mp4',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'asr',
    timestamp: new Date().toISOString(),
  });
});

// Transcribe audio file
app.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
      });
    }

    console.log(`[ASR] Transcribing file: ${req.file.originalname}`);

    // Create read stream for the uploaded file
    const audioStream = fs.createReadStream(req.file.path);

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: process.env.ASR_MODEL || 'whisper-1',
      language: req.body.language || process.env.ASR_LANGUAGE || 'en',
      response_format: 'verbose_json',
    });

    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    console.log(`[ASR] Transcription complete: "${transcription.text.substring(0, 100)}..."`);

    res.json({
      success: true,
      data: {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        segments: transcription.segments,
      },
    });
  } catch (error: any) {
    console.error('[ASR] Transcription error:', error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Transcription failed',
      message: error.message,
    });
  }
});

// Transcribe with streaming (for real-time use)
app.post('/transcribe/stream', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
      });
    }

    console.log(`[ASR] Streaming transcription for: ${req.file.originalname}`);

    const audioStream = fs.createReadStream(req.file.path);

    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: process.env.ASR_MODEL || 'whisper-1',
      language: req.body.language || 'en',
      response_format: 'json',
    });

    // Clean up
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        text: transcription.text,
      },
    });
  } catch (error: any) {
    console.error('[ASR] Streaming transcription error:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Streaming transcription failed',
      message: error.message,
    });
  }
});

// Get supported languages
app.get('/languages', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      supported: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko',
        'ar', 'hi', 'tr', 'vi', 'th', 'sv', 'da', 'no', 'fi', 'cs', 'ro', 'uk',
      ],
      default: 'en',
    },
  });
});

// Start server
app.listen(port, () => {
  console.log(`[ASR] Service started on port ${port}`);
  console.log(`[ASR] Model: ${process.env.ASR_MODEL || 'whisper-1'}`);
  console.log(`[ASR] Default language: ${process.env.ASR_LANGUAGE || 'en'}`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[ASR] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ASR] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
