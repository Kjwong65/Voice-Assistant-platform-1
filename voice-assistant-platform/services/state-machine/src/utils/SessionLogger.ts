import { Pool } from 'pg';
import { Session, ConversationTurn, StateTransition } from '../types';

/**
 * Session logger for persisting conversation data to PostgreSQL
 */
export class SessionLogger {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(255) PRIMARY KEY,
          tenant_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          state VARCHAR(50) NOT NULL,
          config JSONB NOT NULL,
          metrics JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          ended_at TIMESTAMP
        )
      `);

      // Conversation turns table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversation_turns (
          turn_id VARCHAR(255) PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
          user_text TEXT NOT NULL,
          assistant_text TEXT NOT NULL,
          citations JSONB,
          audio_duration_ms INTEGER,
          latency_ms INTEGER,
          created_at TIMESTAMP NOT NULL
        )
      `);

      // State transitions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS state_transitions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
          from_state VARCHAR(50) NOT NULL,
          to_state VARCHAR(50) NOT NULL,
          event VARCHAR(100) NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP NOT NULL
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
        CREATE INDEX IF NOT EXISTS idx_turns_session ON conversation_turns(session_id);
        CREATE INDEX IF NOT EXISTS idx_transitions_session ON state_transitions(session_id);
      `);

      console.log('[SessionLogger] Database tables initialized');
    } catch (error) {
      console.error('[SessionLogger] Database initialization error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save or update session
   */
  async saveSession(session: Session): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `
        INSERT INTO sessions (
          session_id, tenant_id, user_id, state, config, metrics, 
          created_at, updated_at, ended_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (session_id) DO UPDATE SET
          state = $4,
          metrics = $6,
          updated_at = $8,
          ended_at = $9
        `,
        [
          session.session_id,
          session.config.tenantId,
          session.config.userId,
          session.state,
          JSON.stringify(session.config),
          JSON.stringify(session.metrics),
          session.created_at,
          session.last_activity,
          session.metrics.ended_at || null
        ]
      );
    } catch (error) {
      console.error('[SessionLogger] Error saving session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save conversation turn
   */
  async saveTurn(turn: ConversationTurn, session_id: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `
        INSERT INTO conversation_turns (
          turn_id, session_id, user_text, assistant_text, 
          citations, audio_duration_ms, latency_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          turn.turn_id,
          session_id,
          turn.user_text,
          turn.assistant_text,
          JSON.stringify(turn.citations),
          turn.audio_duration_ms,
          turn.latency_ms,
          turn.timestamp
        ]
      );
    } catch (error) {
      console.error('[SessionLogger] Error saving turn:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save state transition
   */
  async saveTransition(transition: StateTransition, session_id: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(
        `
        INSERT INTO state_transitions (
          session_id, from_state, to_state, event, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          session_id,
          transition.from,
          transition.to,
          transition.event,
          JSON.stringify(transition.metadata),
          new Date(transition.timestamp)
        ]
      );
    } catch (error) {
      console.error('[SessionLogger] Error saving transition:', error);
      // Don't throw - transitions are nice to have but not critical
    } finally {
      client.release();
    }
  }

  /**
   * Get session by ID
   */
  async getSession(session_id: string): Promise<Session | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM sessions WHERE session_id = $1',
        [session_id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        session_id: row.session_id,
        config: row.config,
        state: row.state,
        metrics: row.metrics,
        created_at: row.created_at,
        last_activity: row.updated_at,
        conversation_history: [],
        audio_buffer: [],
        transcript_buffer: [],
        state_history: []
      };
    } catch (error) {
      console.error('[SessionLogger] Error getting session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation history for session
   */
  async getConversationHistory(session_id: string): Promise<ConversationTurn[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `
        SELECT * FROM conversation_turns 
        WHERE session_id = $1 
        ORDER BY created_at ASC
        `,
        [session_id]
      );

      return result.rows.map(row => ({
        turn_id: row.turn_id,
        user_text: row.user_text,
        assistant_text: row.assistant_text,
        citations: row.citations,
        audio_duration_ms: row.audio_duration_ms,
        latency_ms: row.latency_ms,
        timestamp: row.created_at
      }));
    } catch (error) {
      console.error('[SessionLogger] Error getting history:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get sessions by tenant
   */
  async getSessionsByTenant(tenant_id: string, limit: number = 50): Promise<Session[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        `
        SELECT * FROM sessions 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
        `,
        [tenant_id, limit]
      );

      return result.rows.map(row => ({
        session_id: row.session_id,
        config: row.config,
        state: row.state,
        metrics: row.metrics,
        created_at: row.created_at,
        last_activity: row.updated_at,
        conversation_history: [],
        audio_buffer: [],
        transcript_buffer: [],
        state_history: []
      }));
    } catch (error) {
      console.error('[SessionLogger] Error getting tenant sessions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
