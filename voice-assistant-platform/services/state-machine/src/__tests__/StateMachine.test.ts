import { ConversationStateMachine } from '../state/StateMachine';
import {
  ConversationState,
  EventType,
  SessionConfig
} from '../types';

describe('ConversationStateMachine', () => {
  let stateMachine: ConversationStateMachine;
  let testConfig: SessionConfig;

  beforeEach(() => {
    stateMachine = new ConversationStateMachine();
    testConfig = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      voice: 'alloy',
      enableBreaths: true,
      enableSSML: true
    };
  });

  describe('Session Management', () => {
    it('should create a new session', () => {
      const session = stateMachine.createSession(testConfig);

      expect(session).toBeDefined();
      expect(session.session_id).toBeDefined();
      expect(session.state).toBe(ConversationState.IDLE);
      expect(session.config).toEqual(testConfig);
      expect(session.conversation_history).toEqual([]);
    });

    it('should retrieve an existing session', () => {
      const session = stateMachine.createSession(testConfig);
      const retrieved = stateMachine.getSession(session.session_id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.session_id).toBe(session.session_id);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = stateMachine.getSession('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should delete a session', () => {
      const session = stateMachine.createSession(testConfig);
      const deleted = stateMachine.deleteSession(session.session_id);

      expect(deleted).toBe(true);
      expect(stateMachine.getSession(session.session_id)).toBeUndefined();
    });

    it('should return false when deleting non-existent session', () => {
      const deleted = stateMachine.deleteSession('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition from IDLE to LISTENING', () => {
      const session = stateMachine.createSession(testConfig);
      const success = stateMachine.transitionTo(
        session.session_id,
        ConversationState.LISTENING
      );

      expect(success).toBe(true);
      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.LISTENING);
    });

    it('should transition from LISTENING to TRANSCRIBING', () => {
      const session = stateMachine.createSession(testConfig);
      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);
      
      const success = stateMachine.transitionTo(
        session.session_id,
        ConversationState.TRANSCRIBING
      );

      expect(success).toBe(true);
      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.TRANSCRIBING);
    });

    it('should reject invalid transitions', () => {
      const session = stateMachine.createSession(testConfig);
      
      // Cannot go directly from IDLE to SPEAKING
      const success = stateMachine.transitionTo(
        session.session_id,
        ConversationState.SPEAKING
      );

      expect(success).toBe(false);
      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.IDLE);
    });

    it('should record state history', () => {
      const session = stateMachine.createSession(testConfig);
      
      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);
      stateMachine.transitionTo(session.session_id, ConversationState.TRANSCRIBING);

      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state_history).toHaveLength(2);
      expect(updated?.state_history[0].from).toBe(ConversationState.IDLE);
      expect(updated?.state_history[0].to).toBe(ConversationState.LISTENING);
      expect(updated?.state_history[1].from).toBe(ConversationState.LISTENING);
      expect(updated?.state_history[1].to).toBe(ConversationState.TRANSCRIBING);
    });

    it('should allow transitions to INTERRUPTED from any state', () => {
      const session = stateMachine.createSession(testConfig);
      
      // Transition through states
      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);
      stateMachine.transitionTo(session.session_id, ConversationState.TRANSCRIBING);
      
      // Interrupt should work
      const success = stateMachine.transitionTo(
        session.session_id,
        ConversationState.INTERRUPTED
      );

      expect(success).toBe(true);
      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.INTERRUPTED);
    });

    it('should allow transitions to ERROR from most states', () => {
      const session = stateMachine.createSession(testConfig);
      
      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);
      
      const success = stateMachine.transitionTo(
        session.session_id,
        ConversationState.ERROR
      );

      expect(success).toBe(true);
      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.ERROR);
    });
  });

  describe('Event Handling', () => {
    it('should handle VAD_START event', async () => {
      const session = stateMachine.createSession(testConfig);

      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.VAD_START,
        data: {},
        timestamp: Date.now()
      });

      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.LISTENING);
    });

    it('should handle USER_INTERRUPT event', async () => {
      const session = stateMachine.createSession(testConfig);
      
      // Set up speaking state
      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);
      stateMachine.transitionTo(session.session_id, ConversationState.TRANSCRIBING);
      stateMachine.transitionTo(session.session_id, ConversationState.INTERPRETING);
      stateMachine.transitionTo(session.session_id, ConversationState.ANSWERING);
      stateMachine.transitionTo(session.session_id, ConversationState.SPEAKING);

      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.USER_INTERRUPT,
        data: {},
        timestamp: Date.now()
      });

      const updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.INTERRUPTED);
      expect(updated?.metrics.interruption_count).toBe(1);
    });

    it('should handle ERROR event and auto-recover', async () => {
      const session = stateMachine.createSession(testConfig);
      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);

      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.ERROR,
        data: { error: 'Test error' },
        timestamp: Date.now()
      });

      let updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.ERROR);
      expect(updated?.metrics.error_count).toBe(1);

      // Wait for auto-recovery (2 seconds in implementation)
      await new Promise(resolve => setTimeout(resolve, 2100));

      updated = stateMachine.getSession(session.session_id);
      expect(updated?.state).toBe(ConversationState.IDLE);
    }, 10000);
  });

  describe('Active Sessions', () => {
    it('should return all active sessions', () => {
      stateMachine.createSession(testConfig);
      stateMachine.createSession({ ...testConfig, userId: 'user-2' });
      stateMachine.createSession({ ...testConfig, userId: 'user-3' });

      const active = stateMachine.getActiveSessions();
      expect(active).toHaveLength(3);
    });

    it('should not include ended sessions', () => {
      const session1 = stateMachine.createSession(testConfig);
      const session2 = stateMachine.createSession({ ...testConfig, userId: 'user-2' });

      stateMachine.deleteSession(session1.session_id);

      const active = stateMachine.getActiveSessions();
      expect(active).toHaveLength(1);
      expect(active[0].session_id).toBe(session2.session_id);
    });
  });

  describe('Cleanup', () => {
    it('should clean up stale sessions', async () => {
      const session = stateMachine.createSession(testConfig);

      // Mock old last_activity (more than 1 hour ago)
      const updated = stateMachine.getSession(session.session_id);
      if (updated) {
        updated.last_activity = new Date(Date.now() - 3700000); // 1 hour + 10 minutes
      }

      const cleaned = stateMachine.cleanupStaleSessions(3600000); // 1 hour threshold

      expect(cleaned).toBe(1);
      expect(stateMachine.getSession(session.session_id)).toBeUndefined();
    });

    it('should not clean up recent sessions', () => {
      stateMachine.createSession(testConfig);

      const cleaned = stateMachine.cleanupStaleSessions(3600000);

      expect(cleaned).toBe(0);
      expect(stateMachine.getActiveSessions()).toHaveLength(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit state_change events', (done) => {
      const session = stateMachine.createSession(testConfig);

      stateMachine.on(EventType.STATE_CHANGE, (data) => {
        expect(data.session_id).toBe(session.session_id);
        expect(data.transition.from).toBe(ConversationState.IDLE);
        expect(data.transition.to).toBe(ConversationState.LISTENING);
        done();
      });

      stateMachine.transitionTo(session.session_id, ConversationState.LISTENING);
    });

    it('should emit session_created events', (done) => {
      stateMachine.on('session_created', (data) => {
        expect(data.config).toEqual(testConfig);
        done();
      });

      stateMachine.createSession(testConfig);
    });

    it('should emit session_deleted events', (done) => {
      const session = stateMachine.createSession(testConfig);

      stateMachine.on('session_deleted', (data) => {
        expect(data.session_id).toBe(session.session_id);
        done();
      });

      stateMachine.deleteSession(session.session_id);
    });
  });

  describe('Complete Conversation Flow', () => {
    it('should handle a full conversation turn', async () => {
      const session = stateMachine.createSession(testConfig);

      // User starts speaking
      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.VAD_START,
        data: {},
        timestamp: Date.now()
      });
      expect(stateMachine.getSession(session.session_id)?.state).toBe(ConversationState.LISTENING);

      // Transcription complete
      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.TRANSCRIPTION_FINAL,
        data: { text: 'What is the PTO policy?', is_final: true },
        timestamp: Date.now()
      });
      expect(stateMachine.getSession(session.session_id)?.state).toBe(ConversationState.INTERPRETING);

      // LLM response ready
      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.LLM_RESPONSE_COMPLETE,
        data: { text: 'The PTO policy is...', citations: [] },
        timestamp: Date.now()
      });
      expect(stateMachine.getSession(session.session_id)?.state).toBe(ConversationState.ANSWERING);

      // TTS starts
      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.TTS_START,
        data: { stream_id: 'stream-123' },
        timestamp: Date.now()
      });
      expect(stateMachine.getSession(session.session_id)?.state).toBe(ConversationState.SPEAKING);

      // TTS completes
      await stateMachine.handleEvent({
        session_id: session.session_id,
        event: EventType.TTS_COMPLETE,
        data: {},
        timestamp: Date.now()
      });
      expect(stateMachine.getSession(session.session_id)?.state).toBe(ConversationState.IDLE);
    });
  });
});
