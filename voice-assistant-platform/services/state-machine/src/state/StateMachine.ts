import EventEmitter from 'eventemitter3';
import {
  ConversationState,
  EventType,
  Session,
  SessionConfig,
  StateTransition,
  EventPayload
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Core state machine for managing conversation flow
 * 
 * State transitions:
 * IDLE → LISTENING (user starts speaking)
 * LISTENING → TRANSCRIBING (audio captured)
 * TRANSCRIBING → INTERPRETING (transcript complete)
 * INTERPRETING → ANSWERING (LLM processing)
 * ANSWERING → SPEAKING (TTS generation)
 * SPEAKING → LISTENING (TTS complete)
 * ANY → INTERRUPTED (user barge-in)
 * INTERRUPTED → LISTENING (interrupt handled)
 */
export class ConversationStateMachine extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private transitionRules: Map<ConversationState, Set<ConversationState>> = new Map();

  constructor() {
    super();
    this.initializeTransitionRules();
  }

  /**
   * Define valid state transitions
   */
  private initializeTransitionRules(): void {
    this.transitionRules.set(ConversationState.IDLE, new Set([
      ConversationState.LISTENING,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.LISTENING, new Set([
      ConversationState.TRANSCRIBING,
      ConversationState.IDLE,
      ConversationState.INTERRUPTED,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.TRANSCRIBING, new Set([
      ConversationState.INTERPRETING,
      ConversationState.LISTENING,
      ConversationState.INTERRUPTED,
      ConversationState.ERROR,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.INTERPRETING, new Set([
      ConversationState.ANSWERING,
      ConversationState.INTERRUPTED,
      ConversationState.ERROR,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.ANSWERING, new Set([
      ConversationState.SPEAKING,
      ConversationState.INTERRUPTED,
      ConversationState.ERROR,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.SPEAKING, new Set([
      ConversationState.LISTENING,
      ConversationState.IDLE,
      ConversationState.INTERRUPTED,
      ConversationState.ERROR,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.INTERRUPTED, new Set([
      ConversationState.LISTENING,
      ConversationState.IDLE,
      ConversationState.ENDED
    ]));

    this.transitionRules.set(ConversationState.ERROR, new Set([
      ConversationState.IDLE,
      ConversationState.LISTENING,
      ConversationState.ENDED
    ]));
  }

  /**
   * Create a new session
   */
  public createSession(config: SessionConfig): Session {
    const session_id = uuidv4();
    const now = new Date();

    const session: Session = {
      session_id,
      config,
      state: ConversationState.IDLE,
      conversation_history: [],
      audio_buffer: [],
      transcript_buffer: [],
      metrics: {
        session_id,
        total_turns: 0,
        total_duration_ms: 0,
        avg_latency_ms: 0,
        interruption_count: 0,
        error_count: 0,
        created_at: now
      },
      state_history: [],
      created_at: now,
      last_activity: now
    };

    this.sessions.set(session_id, session);
    this.emit('session_created', { session_id, config });
    
    return session;
  }

  /**
   * Get session by ID
   */
  public getSession(session_id: string): Session | undefined {
    return this.sessions.get(session_id);
  }

  /**
   * Delete session
   */
  public deleteSession(session_id: string): boolean {
    const session = this.sessions.get(session_id);
    if (!session) return false;

    this.transitionTo(session_id, ConversationState.ENDED);
    this.sessions.delete(session_id);
    this.emit('session_deleted', { session_id });
    
    return true;
  }

  /**
   * Transition to a new state
   */
  public transitionTo(
    session_id: string,
    newState: ConversationState,
    metadata?: Record<string, any>
  ): boolean {
    const session = this.sessions.get(session_id);
    if (!session) {
      console.error(`Session ${session_id} not found`);
      return false;
    }

    const currentState = session.state;

    // Check if transition is valid
    const validTransitions = this.transitionRules.get(currentState);
    if (!validTransitions || !validTransitions.has(newState)) {
      console.warn(
        `Invalid state transition: ${currentState} → ${newState} for session ${session_id}`
      );
      return false;
    }

    // Record transition
    const transition: StateTransition = {
      from: currentState,
      to: newState,
      event: EventType.STATE_CHANGE,
      timestamp: Date.now(),
      metadata
    };

    session.state = newState;
    session.state_history.push(transition);
    session.last_activity = new Date();

    // Emit state change event
    this.emit(EventType.STATE_CHANGE, {
      session_id,
      transition,
      session
    });

    console.log(`[${session_id}] State: ${currentState} → ${newState}`);

    return true;
  }

  /**
   * Handle incoming event
   */
  public async handleEvent(payload: EventPayload): Promise<void> {
    const { session_id, event, data } = payload;
    const session = this.sessions.get(session_id);

    if (!session) {
      console.error(`Session ${session_id} not found for event ${event}`);
      return;
    }

    session.last_activity = new Date();

    switch (event) {
      case EventType.VAD_START:
        await this.handleVADStart(session);
        break;

      case EventType.VAD_END:
        await this.handleVADEnd(session, data);
        break;

      case EventType.USER_AUDIO:
        await this.handleUserAudio(session, data);
        break;

      case EventType.USER_INTERRUPT:
        await this.handleUserInterrupt(session);
        break;

      case EventType.TRANSCRIPTION_FINAL:
        await this.handleTranscriptionFinal(session, data);
        break;

      case EventType.LLM_RESPONSE_COMPLETE:
        await this.handleLLMResponseComplete(session, data);
        break;

      case EventType.TTS_START:
        await this.handleTTSStart(session, data);
        break;

      case EventType.TTS_COMPLETE:
        await this.handleTTSComplete(session);
        break;

      case EventType.ERROR:
        await this.handleError(session, data);
        break;

      default:
        // Forward other events without state changes
        this.emit(event, { session_id, data });
    }
  }

  private async handleVADStart(session: Session): Promise<void> {
    if (session.state === ConversationState.IDLE) {
      this.transitionTo(session.session_id, ConversationState.LISTENING);
    } else if (session.state === ConversationState.SPEAKING) {
      // User started speaking while assistant is talking - interrupt!
      await this.handleUserInterrupt(session);
    }
  }

  private async handleVADEnd(session: Session, data: any): Promise<void> {
    if (session.state === ConversationState.LISTENING) {
      // Silence detected, start transcription
      this.transitionTo(session.session_id, ConversationState.TRANSCRIBING, {
        audio_chunks: session.audio_buffer.length
      });
    }
  }

  private async handleUserAudio(session: Session, data: any): Promise<void> {
    // Buffer audio chunks
    session.audio_buffer.push(data);
    
    if (session.state === ConversationState.IDLE) {
      this.transitionTo(session.session_id, ConversationState.LISTENING);
    }
  }

  private async handleUserInterrupt(session: Session): Promise<void> {
    const currentState = session.state;

    // Only interrupt if assistant is speaking or processing
    if (currentState === ConversationState.SPEAKING ||
        currentState === ConversationState.ANSWERING) {
      
      this.transitionTo(session.session_id, ConversationState.INTERRUPTED, {
        interrupted_state: currentState
      });

      session.metrics.interruption_count++;

      // Emit stop signal for TTS
      this.emit('stop_tts', {
        session_id: session.session_id,
        stream_id: session.tts_stream_id
      });

      // Quick acknowledgment before returning to listening
      setTimeout(() => {
        if (session.state === ConversationState.INTERRUPTED) {
          this.transitionTo(session.session_id, ConversationState.LISTENING);
        }
      }, 200);
    }
  }

  private async handleTranscriptionFinal(session: Session, data: any): Promise<void> {
    if (session.state === ConversationState.TRANSCRIBING) {
      session.transcript_buffer.push(data);
      
      // Start LLM processing
      this.transitionTo(session.session_id, ConversationState.INTERPRETING, {
        transcript: data.text
      });

      // Clear audio buffer
      session.audio_buffer = [];
    }
  }

  private async handleLLMResponseComplete(session: Session, data: any): Promise<void> {
    if (session.state === ConversationState.INTERPRETING) {
      session.pending_response = data;
      
      // Move to answering (TTS generation)
      this.transitionTo(session.session_id, ConversationState.ANSWERING, {
        response_length: data.text?.length || 0
      });
    }
  }

  private async handleTTSStart(session: Session, data: any): Promise<void> {
    if (session.state === ConversationState.ANSWERING) {
      session.tts_stream_id = data.stream_id;
      this.transitionTo(session.session_id, ConversationState.SPEAKING);
    }
  }

  private async handleTTSComplete(session: Session): Promise<void> {
    if (session.state === ConversationState.SPEAKING) {
      // Turn complete, return to idle and wait for user
      this.transitionTo(session.session_id, ConversationState.IDLE);
      
      // Record completed turn
      if (session.current_turn) {
        session.conversation_history.push(session.current_turn as any);
        session.metrics.total_turns++;
        session.current_turn = undefined;
      }

      // Clear buffers
      session.transcript_buffer = [];
      session.pending_response = undefined;
      session.tts_stream_id = undefined;
    }
  }

  private async handleError(session: Session, error: any): Promise<void> {
    console.error(`[${session.session_id}] Error:`, error);
    
    this.transitionTo(session.session_id, ConversationState.ERROR, {
      error: error.message || error
    });

    session.metrics.error_count++;

    // Auto-recover to idle after 2 seconds
    setTimeout(() => {
      if (session.state === ConversationState.ERROR) {
        this.transitionTo(session.session_id, ConversationState.IDLE);
      }
    }, 2000);
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(
      s => s.state !== ConversationState.ENDED
    );
  }

  /**
   * Clean up old sessions
   */
  public cleanupStaleSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [session_id, session] of this.sessions.entries()) {
      const age = now - session.last_activity.getTime();
      if (age > maxAgeMs) {
        this.deleteSession(session_id);
        cleaned++;
      }
    }

    return cleaned;
  }
}
