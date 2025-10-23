import EventEmitter from 'eventemitter3';
import axios from 'axios';
import FormData from 'form-data';
import { 
  Session, 
  AudioChunk, 
  EventType,
  TranscriptionResult,
  LLMResponse,
  ConversationTurn 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Orchestrator coordinates between state machine and backend services
 * 
 * Flow:
 * 1. Collect audio chunks → Send to ASR
 * 2. Receive transcript → Send to LLM with conversation history
 * 3. LLM response → Send to TTS with prosody settings
 * 4. TTS audio → Stream to client via WebRTC
 */
export class ConversationOrchestrator extends EventEmitter {
  private asrServiceUrl: string;
  private llmServiceUrl: string;
  private ttsServiceUrl: string;

  constructor() {
    super();
    
    this.asrServiceUrl = process.env.ASR_SERVICE_URL || 'http://localhost:5001';
    this.llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:5002';
    this.ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:5003';
  }

  /**
   * Process audio chunks through ASR
   */
  public async transcribeAudio(
    session: Session,
    audioChunks: AudioChunk[]
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      // Combine audio chunks into single buffer
      const audioBuffer = Buffer.concat(audioChunks.map(c => c.data));

      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm'
      });

      // Call ASR service
      const response = await axios.post(
        `${this.asrServiceUrl}/transcribe`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 10000
        }
      );

      const latency = Date.now() - startTime;

      const result: TranscriptionResult = {
        text: response.data.data.text,
        is_final: true,
        confidence: 1.0,
        language: response.data.data.language || 'en',
        timestamp: Date.now()
      };

      console.log(`[Orchestrator] Transcription (${latency}ms): "${result.text}"`);

      this.emit(EventType.TRANSCRIPTION_FINAL, {
        session_id: session.session_id,
        result,
        latency_ms: latency
      });

      return result;

    } catch (error: any) {
      console.error('[Orchestrator] ASR error:', error.message);
      
      this.emit(EventType.ERROR, {
        session_id: session.session_id,
        error: 'Transcription failed',
        details: error.message
      });

      throw error;
    }
  }

  /**
   * Get LLM response with RAG and conversation history
   */
  public async getLLMResponse(
    session: Session,
    userText: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Build conversation history
      const messages: any[] = [];
      
      // Add recent conversation context (last 5 turns)
      const recentHistory = session.conversation_history.slice(-5);
      for (const turn of recentHistory) {
        messages.push({ role: 'user', content: turn.user_text });
        messages.push({ role: 'assistant', content: turn.assistant_text });
      }

      // Add current user message
      messages.push({ role: 'user', content: userText });

      // Emit thinking event
      this.emit(EventType.LLM_THINKING, {
        session_id: session.session_id
      });

      // Call LLM service
      const response = await axios.post(
        `${this.llmServiceUrl}/chat`,
        {
          messages,
          tenantId: session.config.tenantId,
          userId: session.config.userId,
          sessionId: session.session_id
        },
        {
          timeout: 30000
        }
      );

      const latency = Date.now() - startTime;

      const llmResponse: LLMResponse = {
        text: response.data.data.response,
        citations: response.data.data.citations || [],
        session_id: session.session_id,
        timestamp: Date.now()
      };

      console.log(`[Orchestrator] LLM response (${latency}ms): "${llmResponse.text.substring(0, 100)}..."`);

      this.emit(EventType.LLM_RESPONSE_COMPLETE, {
        session_id: session.session_id,
        response: llmResponse,
        latency_ms: latency
      });

      return llmResponse;

    } catch (error: any) {
      console.error('[Orchestrator] LLM error:', error.message);
      
      this.emit(EventType.ERROR, {
        session_id: session.session_id,
        error: 'LLM processing failed',
        details: error.message
      });

      throw error;
    }
  }

  /**
   * Synthesize speech with prosody controls
   */
  public async synthesizeSpeech(
    session: Session,
    text: string
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const stream_id = uuidv4();

      // Emit TTS start
      this.emit(EventType.TTS_START, {
        session_id: session.session_id,
        stream_id
      });

      // Call TTS service with prosody settings
      const response = await axios.post(
        `${this.ttsServiceUrl}/synthesize`,
        {
          text,
          voice: session.config.voice || 'alloy',
          tone: session.config.tone,
          energy: session.config.energy,
          pace: session.config.pace,
          prosody: session.config.prosody,
          enableBreaths: session.config.enableBreaths !== false,
          enableSSML: session.config.enableSSML !== false
        },
        {
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      const latency = Date.now() - startTime;
      const audioBuffer = Buffer.from(response.data);

      console.log(`[Orchestrator] TTS generated (${latency}ms): ${audioBuffer.length} bytes`);

      this.emit(EventType.TTS_CHUNK, {
        session_id: session.session_id,
        stream_id,
        audio: audioBuffer,
        is_final: false
      });

      return audioBuffer;

    } catch (error: any) {
      console.error('[Orchestrator] TTS error:', error.message);
      
      this.emit(EventType.ERROR, {
        session_id: session.session_id,
        error: 'Speech synthesis failed',
        details: error.message
      });

      throw error;
    }
  }

  /**
   * Stop ongoing TTS stream
   */
  public async stopTTS(session_id: string, stream_id?: string): Promise<void> {
    console.log(`[Orchestrator] Stopping TTS for session ${session_id}`);
    
    // In a full implementation, this would cancel the HTTP request
    // or send a stop signal to the TTS service
    
    this.emit(EventType.TTS_STOPPED, {
      session_id,
      stream_id
    });
  }

  /**
   * Process complete turn (transcription → LLM → TTS)
   */
  public async processTurn(
    session: Session,
    audioChunks: AudioChunk[]
  ): Promise<void> {
    const turnStartTime = Date.now();

    try {
      // Step 1: Transcribe audio
      const transcription = await this.transcribeAudio(session, audioChunks);
      
      if (!transcription.text || transcription.text.trim().length === 0) {
        console.log('[Orchestrator] Empty transcription, skipping turn');
        return;
      }

      // Step 2: Get LLM response
      const llmResponse = await this.getLLMResponse(session, transcription.text);

      // Step 3: Synthesize speech
      const audioBuffer = await this.synthesizeSpeech(session, llmResponse.text);

      // Record turn metrics
      const turnLatency = Date.now() - turnStartTime;

      const turn: ConversationTurn = {
        turn_id: uuidv4(),
        user_text: transcription.text,
        assistant_text: llmResponse.text,
        citations: llmResponse.citations || [],
        audio_duration_ms: 0, // Would be calculated from audio length
        latency_ms: turnLatency,
        timestamp: new Date()
      };

      // Update session
      session.current_turn = turn;

      // Emit TTS complete
      this.emit(EventType.TTS_COMPLETE, {
        session_id: session.session_id,
        turn,
        audio: audioBuffer
      });

      console.log(`[Orchestrator] Turn complete (${turnLatency}ms total)`);

    } catch (error) {
      console.error('[Orchestrator] Turn processing error:', error);
      
      this.emit(EventType.ERROR, {
        session_id: session.session_id,
        error: 'Turn processing failed'
      });
    }
  }

  /**
   * Health check - verify all services are available
   */
  public async healthCheck(): Promise<{
    asr: boolean;
    llm: boolean;
    tts: boolean;
  }> {
    const checks = {
      asr: false,
      llm: false,
      tts: false
    };

    try {
      const asrResponse = await axios.get(`${this.asrServiceUrl}/health`, { timeout: 3000 });
      checks.asr = asrResponse.status === 200;
    } catch (e) {
      console.error('[Orchestrator] ASR health check failed');
    }

    try {
      const llmResponse = await axios.get(`${this.llmServiceUrl}/health`, { timeout: 3000 });
      checks.llm = llmResponse.status === 200;
    } catch (e) {
      console.error('[Orchestrator] LLM health check failed');
    }

    try {
      const ttsResponse = await axios.get(`${this.ttsServiceUrl}/health`, { timeout: 3000 });
      checks.tts = ttsResponse.status === 200;
    } catch (e) {
      console.error('[Orchestrator] TTS health check failed');
    }

    return checks;
  }
}
