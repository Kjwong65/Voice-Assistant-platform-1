import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const app = express();
const port = process.env.PORT || 5004;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: '/app/uploads',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
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

// Extract text from different file types
async function extractText(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return fs.readFileSync(filePath, 'utf-8');
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error: any) {
    console.error('[RAG] Text extraction error:', error);
    throw error;
  }
}

// Chunk text into smaller pieces
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('[RAG] Embedding error:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rag',
    timestamp: new Date().toISOString(),
  });
});

// Ingest document
app.post('/ingest', upload.single('file'), async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
      });
    }

    const { tenantId = 'demo' } = req.body;

    console.log(`[RAG] Ingesting file: ${req.file.originalname}`);

    await client.query('BEGIN');

    // Get or create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, api_key)
       VALUES ($1, $2)
       ON CONFLICT (api_key) DO UPDATE SET name = $1
       RETURNING id`,
      [tenantId, `${tenantId}-api-key`]
    );
    const tenantDbId = tenantResult.rows[0].id;

    // Create document record
    const docResult = await client.query(
      `INSERT INTO documents (tenant_id, filename, content_type, file_size, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [tenantDbId, req.file.originalname, req.file.mimetype, req.file.size]
    );
    const documentId = docResult.rows[0].id;

    // Extract text
    console.log('[RAG] Extracting text...');
    const text = await extractText(req.file.path, req.file.mimetype);

    // Chunk text
    console.log('[RAG] Chunking text...');
    const chunkSize = parseInt(process.env.RAG_CHUNK_SIZE || '1000');
    const chunkOverlap = parseInt(process.env.RAG_CHUNK_OVERLAP || '200');
    const chunks = chunkText(text, chunkSize, chunkOverlap);

    console.log(`[RAG] Created ${chunks.length} chunks`);

    // Process chunks and generate embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Insert chunk
      const chunkResult = await client.query(
        `INSERT INTO chunks (document_id, tenant_id, content, chunk_index)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [documentId, tenantDbId, chunk, i]
      );
      const chunkId = chunkResult.rows[0].id;

      // Generate and store embedding
      console.log(`[RAG] Generating embedding ${i + 1}/${chunks.length}`);
      const embedding = await generateEmbedding(chunk);

      await client.query(
        `INSERT INTO embeddings (chunk_id, tenant_id, embedding)
         VALUES ($1, $2, $3)`,
        [chunkId, tenantDbId, `[${embedding.join(',')}]`]
      );
    }

    // Update document status
    await client.query(
      `UPDATE documents SET status = 'completed' WHERE id = $1`,
      [documentId]
    );

    await client.query('COMMIT');

    console.log('[RAG] Ingestion complete');

    // Clean up file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        documentId,
        filename: req.file.originalname,
        chunks: chunks.length,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[RAG] Ingestion error:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Ingestion failed',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

// Search knowledge base
app.post('/search', async (req: Request, res: Response) => {
  try {
    const {
      query,
      tenant_id = 'demo',
      top_k = parseInt(process.env.RAG_TOP_K || '5'),
      threshold = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.7'),
    } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
      });
    }

    console.log(`[RAG] Searching for: "${query}"`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Get tenant ID
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE api_key = $1',
      [`${tenant_id}-api-key`]
    );

    if (tenantResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          results: [],
          message: 'No documents found for this tenant',
        },
      });
    }

    const tenantDbId = tenantResult.rows[0].id;

    // Vector similarity search
    const searchResult = await pool.query(
      `SELECT 
        c.id,
        c.content,
        c.chunk_index,
        d.filename,
        1 - (e.embedding <=> $1::vector) AS similarity
       FROM embeddings e
       JOIN chunks c ON c.id = e.chunk_id
       JOIN documents d ON d.id = c.document_id
       WHERE e.tenant_id = $2
         AND 1 - (e.embedding <=> $1::vector) > $3
       ORDER BY similarity DESC
       LIMIT $4`,
      [`[${queryEmbedding.join(',')}]`, tenantDbId, threshold, top_k]
    );

    console.log(`[RAG] Found ${searchResult.rows.length} results`);

    res.json({
      success: true,
      data: {
        results: searchResult.rows.map((row) => ({
          chunkId: row.id,
          content: row.content,
          chunkIndex: row.chunk_index,
          filename: row.filename,
          similarity: parseFloat(row.similarity),
        })),
      },
    });
  } catch (error: any) {
    console.error('[RAG] Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
});

// Retrieve specific chunks
app.post('/retrieve', async (req: Request, res: Response) => {
  try {
    const { chunk_ids } = req.body;

    if (!chunk_ids || !Array.isArray(chunk_ids)) {
      return res.status(400).json({
        error: 'chunk_ids array is required',
      });
    }

    const result = await pool.query(
      `SELECT c.id, c.content, c.chunk_index, d.filename
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.id = ANY($1)`,
      [chunk_ids]
    );

    res.json({
      success: true,
      data: {
        chunks: result.rows,
      },
    });
  } catch (error: any) {
    console.error('[RAG] Retrieve error:', error);
    res.status(500).json({
      error: 'Retrieve failed',
      message: error.message,
    });
  }
});

// Get all documents
app.get('/documents', async (req: Request, res: Response) => {
  try {
    const { tenant_id = 'demo' } = req.query;

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE api_key = $1',
      [`${tenant_id}-api-key`]
    );

    if (tenantResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { documents: [] },
      });
    }

    const result = await pool.query(
      `SELECT id, filename, content_type, file_size, status, created_at
       FROM documents
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantResult.rows[0].id]
    );

    res.json({
      success: true,
      data: {
        documents: result.rows,
      },
    });
  } catch (error: any) {
    console.error('[RAG] Get documents error:', error);
    res.status(500).json({
      error: 'Failed to get documents',
      message: error.message,
    });
  }
});

// Delete document
app.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    res.json({
      success: true,
      data: {
        message: 'Document deleted',
      },
    });
  } catch (error: any) {
    console.error('[RAG] Delete document error:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message,
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[RAG] Service started on port ${port}`);
  console.log(`[RAG] Uploads directory: /app/uploads`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[RAG] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[RAG] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
