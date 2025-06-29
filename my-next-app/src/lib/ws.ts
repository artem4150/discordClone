import type { Message } from '../lib/generated';
import { normalizeUUID } from '../lib/uuid'; // Импорт функции нормализации

export class Gateway {
  private socket: WebSocket | null = null;
  private handlers: Array<(msg: Message) => void> = [];
  private readonly url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private isExplicitlyDisconnected = false;

  constructor(private token: string, private channelId: string) {
    const base = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    this.url = `${base}/ws/chat?token=${token}&channelId=${channelId}`;
  }

  connect() {
    if (this.socket) return;
    this.isExplicitlyDisconnected = false;

    try {
      this.socket = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WS] connection error:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('[WS] connected to', this.url);
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        
        // Нормализация всех UUID полей
        const normalizedMessage: Message = {
          ...rawData,
          channelId: normalizeUUID(rawData.channelId),
          messageId: normalizeUUID(rawData.messageId),
          senderId: normalizeUUID(rawData.senderId),
          createdAt: new Date(rawData.createdAt)
        };

        this.handlers.forEach(cb => cb(normalizedMessage));
      } catch (err) {
        console.error('[WS] message parsing error:', err, event.data);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`[WS] closed: ${event.code} ${event.reason || ''}`);
      this.socket = null;
      
      if (!this.isExplicitlyDisconnected && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (event) => {
      console.error('[WS] error', event);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    
    console.log(`[WS] reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    setTimeout(() => this.connect(), delay);
  }

  onMessage(callback: (msg: Message) => void): () => void {
    this.handlers.push(callback);
    return () => this.offMessage(callback);
  }

  offMessage(callback: (msg: Message) => void) {
    this.handlers = this.handlers.filter(cb => cb !== callback);
  }

  sendMessage(content: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WS] not connected - message skipped');
      return false;
    }
    
    const payload = {
      type: 'MESSAGE_CREATE',
      channelId: this.channelId,
      content
    };
    
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  disconnect() {
    this.isExplicitlyDisconnected = true;
    
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
    
    this.handlers = [];
  }
}