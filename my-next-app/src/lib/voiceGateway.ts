import { normalizeUUID } from "./uuid";

export type VoiceEvent = {
  type: string; // тип события от сервера
  userId?: string;
  data?: any;
  success?: boolean;
  error?: string;
  isSpeaking?: boolean;
  users?: string[];
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
  private speakingThreshold = -60; // Порог громкости для определения речи (дБ)
  private lastSpeakingTime = 0;

  constructor(token: string, channelId: string) {
    this.token = token;
    this.channelId = channelId;
  }

  connect() {
    if (this.socket) return;

    const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const url = `${base}/ws/voice?token=${this.token}&channelId=${this.channelId}`;

    try {
      this.socket = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[Voice] connection error:", error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log("[Voice] connected");
      // отправляем токен (обработчик на бэкенде его ожидает)
      this.socket?.send(JSON.stringify({ token: this.token }));
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);

        if (raw.type === "auth-response") {
          if (!raw.success) {
            console.error("[Voice] auth failed:", raw.error);
            this.handleAuthError(raw.error);
          }
          this.handlers.forEach((h) => h(raw));
          return;
        }

        let out: VoiceEvent | null = null;

        switch (raw.type) {
          case "offer":
          case "answer":
          case "candidate":
            out = {
              type: "signal",
              userId: raw.sender ? normalizeUUID(raw.sender) : undefined,
              data: { type: raw.type, ...raw.payload, target: raw.target },
            };
            break;
          case "user-speaking":
            out = {
              type: "user-speaking",
              userId: raw.sender ? normalizeUUID(raw.sender) : undefined,
              isSpeaking: raw.payload?.isSpeaking,
            };
            break;
          case "join":
          case "leave":
            out = {
              type: raw.type,
              userId: raw.sender ? normalizeUUID(raw.sender) : undefined,
            };
            break;
          case "user-list":
            out = {
              type: "user-list",
              data: raw.payload,
              users: Array.isArray(raw.payload?.users)
                ? raw.payload.users.map((u: string) => normalizeUUID(u))
                : [],
            };
            break;
          default:
            out = {
              type: raw.type,
              userId: raw.sender ? normalizeUUID(raw.sender) : undefined,
              data: raw.payload,
            };
        }

        if (out) {
          this.handlers.forEach((h) => h(out));
        }
      } catch (error) {
        console.error("Failed to parse voice event:", error);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`[Voice] closed: ${event.code} ${event.reason || ""}`);
      this.socket = null;

      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error("[Voice] error:", error);
    };
  }

  private handleAuthError(error: string) {
    console.error("[Voice] auth error:", error);
    this.disconnect();

    if (error.includes("expired") || error.includes("invalid")) {
      console.warn("Token expired or invalid");
      // window.location.href = '/login';
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[Voice] max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts);

    console.log(
      `[Voice] reconnect attempt ${this.reconnectAttempts} in ${delay}ms`,
    );
    setTimeout(() => this.connect(), delay);
  }

  onEvent(callback: (event: VoiceEvent) => void): () => void {
    this.handlers.push(callback);
    return () => this.offEvent(callback);
  }

  offEvent(callback: (event: VoiceEvent) => void) {
    this.handlers = this.handlers.filter((h) => h !== callback);
  }

  send(event: Record<string, any>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("[Voice] not connected - message skipped");
      return false;
    }

    const payload = { room: this.channelId, ...event };
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close(1000, "User disconnected");
      this.socket = null;
    }
    this.handlers = [];
  }
  private startSpeakingDetection(stream: MediaStream) {
    if (this.audioContext || this.speakingCheckInterval) return;

    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
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
          this.send({ type: "user-speaking", payload: { isSpeaking } });
        }

        // Обновляем время последней активности
        if (isSpeaking) {
          this.lastSpeakingTime = Date.now();
        }
      }, 200); // Проверка каждые 200 мс
    } catch (error) {
      console.error("Error starting speaking detection:", error);
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
  playSound(type: "connect" | "disconnect") {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.play().catch((error) => {
      console.error(`Failed to play ${type} sound:`, error);
    });
  }
}
