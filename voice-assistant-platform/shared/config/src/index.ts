// ==============================================
// SHARED CONFIGURATION - Voice Assistant Platform
// ==============================================

import dotenv from 'dotenv';
import { ServiceConfig } from '@shared/types';

// Load environment variables
dotenv.config();

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue!;
}

/**
 * Get numeric environment variable
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Get boolean environment variable
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

// ==============================================
// COMMON CONFIGURATION
// ==============================================

export const config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
  isProduction: getEnv('NODE_ENV', 'development') === 'production',

  // OpenAI
  openai: {
    apiKey: getEnv('OPENAI_API_KEY'),
    orgId: process.env.OPENAI_ORG_ID,
  },

  // Database
  database: {
    url: getEnv('DATABASE_URL'),
    host: getEnv('POSTGRES_HOST', 'localhost'),
    port: getEnvNumber('POSTGRES_PORT', 5432),
    database: getEnv('POSTGRES_DB', 'voice_assistant'),
    user: getEnv('POSTGRES_USER', 'postgres'),
    password: getEnv('POSTGRES_PASSWORD', 'postgres'),
    poolSize: getEnvNumber('DB_POOL_SIZE', 10),
  },

  // Redis
  redis: {
    url: getEnv('REDIS_URL', 'redis://localhost:6379'),
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD,
  },

  // JWT
  jwt: {
    secret: getEnv('JWT_SECRET'),
    expiry: getEnv('JWT_EXPIRY', '24h'),
  },

  // CORS
  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3001'),
    credentials: true,
  },

  // File Upload
  upload: {
    directory: getEnv('UPLOAD_DIR', './uploads'),
    maxFileSize: getEnvNumber('MAX_FILE_SIZE', 104857600), // 100MB
    allowedTypes: getEnv('ALLOWED_FILE_TYPES', '.pdf,.docx,.txt,.md,.csv').split(','),
  },

  // AI Models
  models: {
    whisper: getEnv('WHISPER_MODEL', 'whisper-1'),
    llm: getEnv('LLM_MODEL', 'gpt-4o'),
    llmTemperature: parseFloat(getEnv('LLM_TEMPERATURE', '0.7')),
    llmMaxTokens: getEnvNumber('LLM_MAX_TOKENS', 2000),
    tts: getEnv('TTS_MODEL', 'tts-1'),
    ttsVoice: getEnv('TTS_VOICE', 'alloy'),
    ttsSpeed: parseFloat(getEnv('TTS_SPEED', '1.0')),
    embedding: getEnv('EMBEDDING_MODEL', 'text-embedding-3-small'),
    embeddingDimensions: getEnvNumber('EMBEDDING_DIMENSIONS', 1536),
  },

  // RAG
  rag: {
    chunkSize: getEnvNumber('CHUNK_SIZE', 500),
    chunkOverlap: getEnvNumber('CHUNK_OVERLAP', 50),
    topK: getEnvNumber('TOP_K_RESULTS', 5),
  },

  // WebRTC
  webrtc: {
    turnServer: process.env.TURN_SERVER_URL,
    turnUsername: process.env.TURN_USERNAME,
    turnPassword: process.env.TURN_PASSWORD,
    stunServer: getEnv('STUN_SERVER_URL', 'stun:stun.l.google.com:19302'),
  },

  // Observability
  observability: {
    jaegerEndpoint: process.env.JAEGER_ENDPOINT,
    jaegerHost: getEnv('OTEL_EXPORTER_JAEGER_AGENT_HOST', 'localhost'),
    jaegerPort: getEnvNumber('OTEL_EXPORTER_JAEGER_AGENT_PORT', 6831),
    prometheusPort: getEnvNumber('PROMETHEUS_PORT', 9090),
    metricsEnabled: getEnvBoolean('METRICS_ENABLED', true),
  },

  // Logging
  logging: {
    level: getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
    format: getEnv('LOG_FORMAT', 'json') as 'json' | 'pretty',
  },

  // Feature Flags
  features: {
    bargeIn: getEnvBoolean('ENABLE_BARGE_IN', true),
    ragFallback: getEnvBoolean('ENABLE_RAG_FALLBACK', true),
    streaming: getEnvBoolean('ENABLE_STREAMING', true),
    functionCalling: getEnvBoolean('ENABLE_FUNCTION_CALLING', true),
    citationTracking: getEnvBoolean('ENABLE_CITATION_TRACKING', true),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  // Multi-Tenant
  tenant: {
    defaultId: getEnv('DEFAULT_TENANT_ID', 'demo'),
    isolation: getEnvBoolean('TENANT_ISOLATION', true),
  },
};

// ==============================================
// SERVICE-SPECIFIC CONFIGURATIONS
// ==============================================

export function getGatewayConfig(): ServiceConfig {
  return {
    port: getEnvNumber('GATEWAY_PORT', 3000),
    host: getEnv('HOST', '0.0.0.0'),
    cors: config.cors,
    database: config.database,
    redis: config.redis,
    openai: config.openai,
    logging: config.logging,
    observability: config.observability,
  };
}

export function getASRConfig(): ServiceConfig {
  return {
    port: getEnvNumber('ASR_PORT', 5001),
    host: getEnv('HOST', '0.0.0.0'),
    cors: config.cors,
    database: config.database,
    redis: config.redis,
    openai: config.openai,
    logging: config.logging,
    observability: config.observability,
  };
}

export function getLLMConfig(): ServiceConfig {
  return {
    port: getEnvNumber('LLM_PORT', 5002),
    host: getEnv('HOST', '0.0.0.0'),
    cors: config.cors,
    database: config.database,
    redis: config.redis,
    openai: config.openai,
    logging: config.logging,
    observability: config.observability,
  };
}

export function getTTSConfig(): ServiceConfig {
  return {
    port: getEnvNumber('TTS_PORT', 5003),
    host: getEnv('HOST', '0.0.0.0'),
    cors: config.cors,
    database: config.database,
    redis: config.redis,
    openai: config.openai,
    logging: config.logging,
    observability: config.observability,
  };
}

export function getRAGConfig(): ServiceConfig {
  return {
    port: getEnvNumber('RAG_PORT', 5004),
    host: getEnv('HOST', '0.0.0.0'),
    cors: config.cors,
    database: config.database,
    redis: config.redis,
    openai: config.openai,
    logging: config.logging,
    observability: config.observability,
  };
}

export function getConsoleConfig(): ServiceConfig {
  return {
    port: getEnvNumber('CONSOLE_PORT', 3001),
    host: getEnv('HOST', '0.0.0.0'),
    cors: config.cors,
    database: config.database,
    redis: config.redis,
    openai: config.openai,
    logging: config.logging,
    observability: config.observability,
  };
}

// ==============================================
// VALIDATION
// ==============================================

export function validateConfig() {
  const required = [
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'JWT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✅ Configuration validated successfully');
}

// Validate on import
if (config.isProduction) {
  validateConfig();
}
