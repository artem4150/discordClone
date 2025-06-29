import { normalizeUUID } from './uuid';

export type VoiceEvent = {
  id: any;
  type: 'join' | 'leave' | 'signal' | 'auth-response' | 'user-speaking';
  userId?: string;
  data?: any;
  success?: boolean;
  error?: string;
  isSpeaking?: boolean;
};


export class VoiceGateway {
  private socket: WebSocket | null = null;
  private handlers: Array<(event: VoiceEvent) => void> = [];
  private channelId: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingCheckInterval: NodeJS.Timeout | null = null;
  private speakingThreshold = -45; // Порог громкости для определения речи (дБ)
  private lastSpeakingTime = 0;

  constructor(token: string, channelId: string) {
    this.token = token;
    this.channelId = channelId;
  }

  connect() {
    if (this.socket) return;
    
    const base = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const url = `${base}/ws/voice`;
    
    try {
      this.socket = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[Voice] connection error:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('[Voice] connected');
      // Отправляем аутентификационные данные
      this.socket?.send(JSON.stringify({
        type: 'auth',
        token: this.token,
        channelId: this.channelId
      }));
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'auth-response') {
          if (!data.success) {
            console.error('[Voice] auth failed:', data.error);
            this.handleAuthError(data.error);
          }
          
          // Всегда передаем auth-response обработчикам
          this.handlers.forEach(handler => handler(data));
          return;
        }

        // Для других событий нормализуем userId
        const normalizedEvent: VoiceEvent = {
          ...data,
          userId: data.userId ? normalizeUUID(data.userId) : undefined
        };
        
        this.handlers.forEach(handler => handler(normalizedEvent));
      } catch (error) {
        console.error('Failed to parse voice event:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`[Voice] closed: ${event.code} ${event.reason || ''}`);
      this.socket = null;
      
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error('[Voice] error:', error);
    };
  }

  private handleAuthError(error: string) {
    console.error('[Voice] auth error:', error);
    this.disconnect();
    
    if (error.includes('expired') || error.includes('invalid')) {
      console.warn('Token expired or invalid');
      // window.location.href = '/login';
    }
  }

  
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Voice] max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    
    console.log(`[Voice] reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    setTimeout(() => this.connect(), delay);
  }

  onEvent(callback: (event: VoiceEvent) => void): () => void {
    this.handlers.push(callback);
    return () => this.offEvent(callback);
  }

  offEvent(callback: (event: VoiceEvent) => void) {
    this.handlers = this.handlers.filter(h => h !== callback);
  }

  send(event: Omit<VoiceEvent, 'userId'>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[Voice] not connected - message skipped');
      return false;
    }
    
    this.socket.send(JSON.stringify(event));
    return true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
    this.handlers = [];
  }
 private startSpeakingDetection(stream: MediaStream) {
    if (this.audioContext || this.speakingCheckInterval) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      
      source.connect(this.analyser);
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let lastSpeakingState = false;
      
      this.speakingCheckInterval = setInterval(() => {
        if (!this.analyser) return;
        
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        
        const average = sum / bufferLength;
        const decibels = 20 * Math.log10(average / 255);
        const isSpeaking = decibels > this.speakingThreshold;
        
        // Отправляем событие только при изменении состояния
        if (isSpeaking !== lastSpeakingState) {
          lastSpeakingState = isSpeaking;
          this.socket?.send(JSON.stringify({
            type: 'user-speaking',
            isSpeaking
          }));
        }
        
        // Обновляем время последней активности
        if (isSpeaking) {
          this.lastSpeakingTime = Date.now();
        }
      }, 200); // Проверка каждые 200 мс
    } catch (error) {
      console.error('Error starting speaking detection:', error);
    }
  }

  // Остановка анализа речи
  private stopSpeakingDetection() {
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
      this.speakingCheckInterval = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
  }

  // Воспроизведение звука
  playSound(type: 'connect' | 'disconnect') {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.play().catch(error => {
      console.error(`Failed to play ${type} sound:`, error);
    });
  }
}
  


