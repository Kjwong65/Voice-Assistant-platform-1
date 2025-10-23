// ==============================================
// SHARED TYPES - Voice Assistant Platform
// ==============================================

// ==============================================
// TENANT & AUTHENTICATION
// ==============================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  openaiKey?: string;
  settings: Record<string, any>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  active: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  userId: string;
  tenantId: string;
  role: string;
  exp: number;
  iat: number;
}

// ==============================================
// SESSION & CONVERSATION
// ==============================================

export interface Session {
  id: string;
  tenantId: string;
  userId?: string;
  channel: 'web' | 'phone' | 'api';
  metadata: Record<string, any>;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  turnCount: number;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  turnNumber: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audioUrl?: string;
  metadata: Record<string, any>;
  citations?: Citation[];
  functionCalls?: FunctionCall[];
  timestamp: Date;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  pageNumber?: number;
  sectionTitle?: string;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
}

// ==============================================
// ASR (SPEECH RECOGNITION)
// ==============================================

export interface TranscriptionRequest {
  audio: Buffer | File;
  language?: string;
  model?: string;
}

export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

// ==============================================
// LLM (LANGUAGE MODEL)
// ==============================================

export interface ChatRequest {
  messages: ChatMessage[];
  tenantId: string;
  sessionId?: string;
  userId?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ChatResponse {
  response: string;
  citations?: Citation[];
  functionCalls?: FunctionCall[];
  usage?: TokenUsage;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ==============================================
// TTS (TEXT-TO-SPEECH)
// ==============================================

export interface SynthesisRequest {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
  tone?: 'neutral' | 'friendly' | 'professional' | 'formal';
  ssml?: boolean;
}

export interface SynthesisResponse {
  audio: Buffer;
  contentType: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface SSMLOptions {
  tone?: string;
  pace?: number;
  energy?: number;
  addBreaths?: boolean;
}

// ==============================================
// RAG (RETRIEVAL AUGMENTED GENERATION)
// ==============================================

export interface Document {
  id: string;
  tenantId: string;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  metadata: Record<string, any>;
  uploadedBy?: string;
  uploadedAt: Date;
  processedAt?: Date;
  chunkCount: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  pageNumber?: number;
  sectionTitle?: string;
  createdAt: Date;
}

export interface SearchRequest {
  query: string;
  tenantId: string;
  topK?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface SearchResult {
  chunks: DocumentChunk[];
  scores: number[];
  documents: Document[];
}

// ==============================================
// WEBRTC & REAL-TIME
// ==============================================

export interface WebRTCSession {
  sessionId: string;
  peerId: string;
  sdp?: string;
  iceServers: RTCIceServer[];
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sequenceNumber: number;
}

export interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  event: string;
  timestamp: Date;
}

export type ConversationState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'error';

// ==============================================
// ANALYTICS & MONITORING
// ==============================================

export interface AnalyticsEvent {
  id: string;
  tenantId: string;
  sessionId?: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

export interface ApiUsage {
  id: string;
  tenantId: string;
  service: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  dependencies: {
    [key: string]: {
      status: 'up' | 'down';
      latency?: number;
    };
  };
  timestamp: Date;
}

// ==============================================
// API RESPONSES
// ==============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: Record<string, any>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

// ==============================================
// CONFIGURATION
// ==============================================

export interface ServiceConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  database: {
    url: string;
    poolSize: number;
  };
  redis: {
    url: string;
  };
  openai: {
    apiKey: string;
    orgId?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'pretty';
  };
  observability: {
    jaegerEndpoint?: string;
    prometheusPort?: number;
    metricsEnabled: boolean;
  };
}
