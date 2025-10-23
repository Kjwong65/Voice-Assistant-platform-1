/**
 * Voice conversation state machine types
 */

export enum ConversationState {
  IDLE = 'idle',
  LISTENING = 'listening',
  TRANSCRIBING = 'transcribing',
  INTERPRETING = 'interpreting',
  ANSWERING = 'answering',
  SPEAKING = 'speaking',
  INTERRUPTED = 'interrupted',
  ERROR = 'error',
  ENDED = 'ended'
}

export enum EventType {
  // User events
  START_SESSION = 'start_session',
  END_SESSION = 'end_session',
  USER_AUDIO = 'user_audio',
  USER_INTERRUPT = 'user_interrupt',
  VAD_START = 'vad_start',
  VAD_END = 'vad_end',
  
  // System events
  TRANSCRIPTION_PARTIAL = 'transcription_partial',
  TRANSCRIPTION_FINAL = 'transcription_final',
  LLM_THINKING = 'llm_thinking',
  LLM_RESPONSE_START = 'llm_response_start',
  LLM_RESPONSE_CHUNK = 'llm_response_chunk',
  LLM_RESPONSE_COMPLETE = 'llm_response_complete',
  TTS_START = 'tts_start',
  TTS_CHUNK = 'tts_chunk',
  TTS_COMPLETE = 'tts_complete',
  TTS_STOPPED = 'tts_stopped',
  
  // State transitions
  STATE_CHANGE = 'state_change',
  ERROR = 'error'
}

export interface SessionConfig {
  tenantId: string;
  userId: string;
  voice?: string;
  tone?: string;
  energy?: string;
  pace?: string;
  prosody?: string;
  enableBreaths?: boolean;
  enableSSML?: boolean;
  interruptionThreshold?: number; // ms
  silenceThreshold?: number; // ms
  vadSensitivity?: number; // 0-1
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

export interface TranscriptionResult {
  text: string;
  is_final: boolean;
  confidence?: number;
  language?: string;
  timestamp: number;
}

export interface LLMResponse {
  text: string;
  tool_calls?: ToolCall[];
  citations?: Citation[];
  session_id?: string;
  timestamp: number;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  filename: string;
  score: number;
  page?: number;
  section?: string;
}

export interface TTSChunk {
  audio: Buffer;
  timestamp: number;
  is_final: boolean;
}

export interface ConversationTurn {
  turn_id: string;
  user_text: string;
  assistant_text: string;
  citations: Citation[];
  audio_duration_ms: number;
  latency_ms: number;
  timestamp: Date;
}

export interface SessionMetrics {
  session_id: string;
  total_turns: number;
  total_duration_ms: number;
  avg_latency_ms: number;
  interruption_count: number;
  error_count: number;
  created_at: Date;
  ended_at?: Date;
}

export interface StateTransition {
  from: ConversationState;
  to: ConversationState;
  event: EventType;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface Session {
  session_id: string;
  config: SessionConfig;
  state: ConversationState;
  conversation_history: ConversationTurn[];
  current_turn?: Partial<ConversationTurn>;
  audio_buffer: AudioChunk[];
  transcript_buffer: TranscriptionResult[];
  pending_response?: LLMResponse;
  tts_stream_id?: string;
  metrics: SessionMetrics;
  state_history: StateTransition[];
  created_at: Date;
  last_activity: Date;
}

export interface WebRTCConfig {
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
}

export interface EventPayload {
  session_id: string;
  event: EventType;
  data: any;
  timestamp: number;
}
