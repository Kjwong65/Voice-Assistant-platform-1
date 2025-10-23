import { WebSocket } from 'ws';
import EventEmitter from 'eventemitter3';
import { AudioChunk, Session, EventType } from '../types';

/**
 * WebRTC handler for real-time bidirectional audio streaming
 * 
 * Handles:
 * - WebSocket signaling (SDP offer/answer, ICE candidates)
 * - Audio stream management (receive user audio, send TTS audio)
 * - Voice Activity Detection (VAD)
 * - Connection lifecycle
 */
export class WebRTCHandler extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private audioStreams: Map<string, NodeJS.Timer> = new Map();
  
  // VAD configuration
  private vadThreshold = 0.01; // Audio energy threshold
  private silenceThreshold = 1000; // ms of silence before VAD end
  private silenceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  /**
   * Handle new WebSocket connection
   */
  public handleConnection(ws: WebSocket, session_id: string): void {
    console.log(`[WebRTC] New connection for session ${session_id}`);
    
    this.connections.set(session_id, ws);

    // Set up message handlers
    ws.on('message', (data: Buffer) => {
      this.handleMessage(session_id, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(session_id);
    });

    ws.on('error', (error) => {
      console.error(`[WebRTC] Error for session ${session_id}:`, error);
      this.emit('error', { session_id, error });
    });

    // Send ready signal
    this.sendMessage(session_id, {
      type: 'ready',
      session_id
    });
  }

  /**
   * Handle incoming messages (signaling or audio data)
   */
  private handleMessage(session_id: string, data: Buffer): void {
    try {
      // Try to parse as JSON (signaling message)
      const message = JSON.parse(data.toString());
      this.handleSignalingMessage(session_id, message);
    } catch (e) {
      // Raw binary audio data
      this.handleAudioData(session_id, data);
    }
  }

  /**
   * Handle WebRTC signaling messages
   */
  private handleSignalingMessage(session_id: string, message: any): void {
    const { type } = message;

    switch (type) {
      case 'offer':
        this.handleOffer(session_id, message);
        break;

      case 'ice-candidate':
        this.handleICECandidate(session_id, message);
        break;

      case 'start-recording':
        this.emit('start_recording', { session_id });
        break;

      case 'stop-recording':
        this.emit('stop_recording', { session_id });
        break;

      case 'interrupt':
        this.emit('user_interrupt', { session_id });
        break;

      default:
        console.warn(`[WebRTC] Unknown signaling message type: ${type}`);
    }
  }

  /**
   * Handle SDP offer from client
   */
  private handleOffer(session_id: string, message: any): void {
    // In a real implementation, this would use node-webrtc to create
    // a peer connection, set remote description, and create answer
    
    // For now, send a mock answer
    const answer = {
      type: 'answer',
      sdp: 'mock-sdp-answer'
    };

    this.sendMessage(session_id, answer);
    this.emit('connection_established', { session_id });
  }

  /**
   * Handle ICE candidate from client
   */
  private handleICECandidate(session_id: string, message: any): void {
    console.log(`[WebRTC] ICE candidate received for ${session_id}`);
    // In real implementation, add ICE candidate to peer connection
  }

  /**
   * Handle incoming audio data from user
   */
  private handleAudioData(session_id: string, data: Buffer): void {
    const now = Date.now();

    // Create audio chunk
    const chunk: AudioChunk = {
      data,
      timestamp: now,
      sampleRate: 16000, // Assume 16kHz
      channels: 1
    };

    // Emit audio chunk for processing
    this.emit(EventType.USER_AUDIO, {
      session_id,
      data: chunk
    });

    // Perform simple VAD
    this.performVAD(session_id, data);
  }

  /**
   * Simple Voice Activity Detection
   * Checks audio energy and emits VAD start/end events
   */
  private performVAD(session_id: string, audioData: Buffer): void {
    // Calculate RMS energy
    const energy = this.calculateRMSEnergy(audioData);
    
    const isSpeaking = energy > this.vadThreshold;

    if (isSpeaking) {
      // Clear any silence timer
      const timer = this.silenceTimers.get(session_id);
      if (timer) {
        clearTimeout(timer);
        this.silenceTimers.delete(session_id);
      }

      // Emit VAD start if not already speaking
      if (!this.audioStreams.has(session_id)) {
        this.audioStreams.set(session_id, Date.now() as any);
        this.emit(EventType.VAD_START, { session_id });
      }
    } else {
      // Potential end of speech
      if (this.audioStreams.has(session_id) && !this.silenceTimers.has(session_id)) {
        // Start silence timer
        const timer = setTimeout(() => {
          this.audioStreams.delete(session_id);
          this.silenceTimers.delete(session_id);
          this.emit(EventType.VAD_END, { session_id });
        }, this.silenceThreshold);

        this.silenceTimers.set(session_id, timer);
      }
    }
  }

  /**
   * Calculate RMS energy of audio buffer
   */
  private calculateRMSEnergy(buffer: Buffer): number {
    let sum = 0;
    const samples = buffer.length / 2; // Assuming 16-bit PCM

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i) / 32768.0; // Normalize to [-1, 1]
      sum += sample * sample;
    }

    return Math.sqrt(sum / samples);
  }

  /**
   * Send TTS audio to client
   */
  public sendAudio(session_id: string, audioData: Buffer, is_final: boolean = false): void {
    const ws = this.connections.get(session_id);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebRTC] Cannot send audio - connection not open for ${session_id}`);
      return;
    }

    // Send audio header
    const header = Buffer.from(JSON.stringify({
      type: 'audio',
      is_final,
      timestamp: Date.now()
    }) + '\n');

    // Send header + audio data
    const packet = Buffer.concat([header, audioData]);
    ws.send(packet);
  }

  /**
   * Send JSON message to client
   */
  public sendMessage(session_id: string, message: any): void {
    const ws = this.connections.get(session_id);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebRTC] Cannot send message - connection not open for ${session_id}`);
      return;
    }

    ws.send(JSON.stringify(message));
  }

  /**
   * Stop TTS playback
   */
  public stopTTS(session_id: string): void {
    this.sendMessage(session_id, {
      type: 'stop-tts',
      timestamp: Date.now()
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(session_id: string): void {
    console.log(`[WebRTC] Connection closed for session ${session_id}`);
    
    // Clean up
    this.connections.delete(session_id);
    this.audioStreams.delete(session_id);
    
    const timer = this.silenceTimers.get(session_id);
    if (timer) {
      clearTimeout(timer);
      this.silenceTimers.delete(session_id);
    }

    this.emit('disconnected', { session_id });
  }

  /**
   * Close connection
   */
  public closeConnection(session_id: string): void {
    const ws = this.connections.get(session_id);
    if (ws) {
      ws.close();
      this.handleDisconnect(session_id);
    }
  }

  /**
   * Get connection status
   */
  public isConnected(session_id: string): boolean {
    const ws = this.connections.get(session_id);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get all active connections
   */
  public getActiveConnections(): string[] {
    return Array.from(this.connections.keys()).filter(
      session_id => this.isConnected(session_id)
    );
  }

  /**
   * Update VAD configuration
   */
  public configureVAD(threshold: number, silenceMs: number): void {
    this.vadThreshold = threshold;
    this.silenceThreshold = silenceMs;
    console.log(`[WebRTC] VAD configured: threshold=${threshold}, silence=${silenceMs}ms`);
  }
}
