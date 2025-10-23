import express, { Request, Response } from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import { Pool } from 'pg';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 5002;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json());

// Tool definitions for function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search the knowledge base for relevant information. Use this to answer questions about documents, policies, procedures, or any information that might be in uploaded files.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant information',
          },
          top_k: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'retrieve_passages',
      description: 'Retrieve specific passages from documents by chunk IDs',
      parameters: {
        type: 'object',
        properties: {
          chunk_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of chunk IDs to retrieve',
          },
        },
        required: ['chunk_ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_for_speech',
      description: 'Condense a long text into a concise summary suitable for speech output',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to summarize',
          },
          max_words: {
            type: 'number',
            description: 'Maximum number of words in summary (default: 50)',
            default: 50,
          },
        },
        required: ['text'],
      },
    },
  },
];

// Function implementations
async function searchFiles(tenantId: string, query: string, topK: number = 5) {
  try {
    const ragUrl = process.env.RAG_SERVICE_URL || 'http://rag:5004';
    const response = await axios.post(`${ragUrl}/search`, {
      query,
      tenant_id: tenantId,
      top_k: topK,
    });

    return {
      success: true,
      results: response.data.data.results,
    };
  } catch (error: any) {
    console.error('[LLM] Search files error:', error.message);
    return {
      success: false,
      error: error.message,
      results: [],
    };
  }
}

async function retrievePassages(chunkIds: string[]) {
  try {
    const ragUrl = process.env.RAG_SERVICE_URL || 'http://rag:5004';
    const response = await axios.post(`${ragUrl}/retrieve`, {
      chunk_ids: chunkIds,
    });

    return {
      success: true,
      passages: response.data.data.chunks,
    };
  } catch (error: any) {
    console.error('[LLM] Retrieve passages error:', error.message);
    return {
      success: false,
      error: error.message,
      passages: [],
    };
  }
}

async function summarizeForSpeech(text: string, maxWords: number = 50) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Summarize the following text in at most ${maxWords} words. Make it natural and conversational for speech output.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
    });

    return {
      success: true,
      summary: completion.choices[0].message.content,
    };
  } catch (error: any) {
    console.error('[LLM] Summarize error:', error.message);
    return {
      success: false,
      error: error.message,
      summary: text.substring(0, maxWords * 5),
    };
  }
}

// Execute tool calls
async function executeToolCall(tenantId: string, toolCall: any) {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);

  console.log(`[LLM] Executing tool: ${name}`, parsedArgs);

  switch (name) {
    case 'search_files':
      return await searchFiles(tenantId, parsedArgs.query, parsedArgs.top_k);
    case 'retrieve_passages':
      return await retrievePassages(parsedArgs.chunk_ids);
    case 'summarize_for_speech':
      return await summarizeForSpeech(parsedArgs.text, parsedArgs.max_words);
    default:
      return { success: false, error: 'Unknown tool' };
  }
}

// Save conversation history
async function saveConversation(sessionId: string, tenantId: string, messages: any[]) {
  try {
    await pool.query(
      `INSERT INTO conversations (session_id, tenant_id, messages, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET messages = $3, updated_at = NOW()`,
      [sessionId, tenantId, JSON.stringify(messages)]
    );
  } catch (error: any) {
    console.error('[LLM] Save conversation error:', error.message);
  }
}

// Get conversation history
async function getConversation(sessionId: string) {
  try {
    const result = await pool.query(
      'SELECT messages FROM conversations WHERE session_id = $1',
      [sessionId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].messages;
    }
    return [];
  } catch (error: any) {
    console.error('[LLM] Get conversation error:', error.message);
    return [];
  }
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'llm',
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint with tool calling
app.post('/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      tenantId = 'demo',
      sessionId = `session-${Date.now()}`,
      model = process.env.LLM_MODEL || 'gpt-4o',
      temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      max_tokens = parseInt(process.env.LLM_MAX_TOKENS || '4096'),
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Messages array is required',
      });
    }

    console.log(`[LLM] Chat request - Session: ${sessionId}, Tenant: ${tenantId}`);

    // Get tenant config
    const tenantResult = await pool.query(
      'SELECT config FROM tenants WHERE api_key = $1',
      [`${tenantId}-api-key`]
    );

    const systemPrompt =
      tenantResult.rows[0]?.config?.system_prompt ||
      'You are a helpful AI assistant with access to a knowledge base. When users ask questions, search the knowledge base first. Provide accurate, concise answers with citations when using information from documents.';

    // Prepare messages with system prompt
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Initial LLM call
    let completion = await openai.chat.completions.create({
      model,
      messages: conversationMessages as any,
      tools: tools as any,
      tool_choice: 'auto',
      temperature,
      max_tokens,
    });

    let response = completion.choices[0].message;
    const toolCalls = [];
    let iterations = 0;
    const maxIterations = 5;

    // Handle tool calls
    while (response.tool_calls && iterations < maxIterations) {
      console.log(`[LLM] Processing ${response.tool_calls.length} tool calls`);

      // Execute all tool calls
      const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
          const result = await executeToolCall(tenantId, toolCall);
          toolCalls.push({
            tool: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            result,
          });

          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          };
        })
      );

      // Add assistant message and tool results to conversation
      conversationMessages.push(response as any);
      conversationMessages.push(...(toolResults as any));

      // Get next response
      completion = await openai.chat.completions.create({
        model,
        messages: conversationMessages as any,
        tools: tools as any,
        tool_choice: 'auto',
        temperature,
        max_tokens,
      });

      response = completion.choices[0].message;
      iterations++;
    }

    console.log(`[LLM] Final response: "${response.content?.substring(0, 100)}..."`);

    // Save conversation
    const updatedMessages = [...messages, { role: 'assistant', content: response.content }];
    await saveConversation(sessionId, tenantId, updatedMessages);

    res.json({
      success: true,
      data: {
        response: response.content,
        sessionId,
        toolCalls,
        usage: completion.usage,
      },
    });
  } catch (error: any) {
    console.error('[LLM] Chat error:', error);
    res.status(500).json({
      error: 'Chat failed',
      message: error.message,
    });
  }
});

// Get conversation history
app.get('/chat/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const messages = await getConversation(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        messages,
      },
    });
  } catch (error: any) {
    console.error('[LLM] Get history error:', error);
    res.status(500).json({
      error: 'Failed to get history',
      message: error.message,
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`[LLM] Service started on port ${port}`);
  console.log(`[LLM] Model: ${process.env.LLM_MODEL || 'gpt-4o'}`);
  console.log(`[LLM] RAG Service: ${process.env.RAG_SERVICE_URL || 'http://rag:5004'}`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('[LLM] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[LLM] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
