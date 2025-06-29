import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { getAuthToken, useAuth } from '../store/useAuth';
import type {
  User,
  Guild,
  Channel,
  Message,
  ChannelType
} from '../lib/generated';
import { base64ToUUID, normalizeUUID } from './uuid';
const API_URL = process.env.NEXT_PUBLIC_API_URL!; // e.g. http://localhost:8000

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // если у вас httpOnly-куки
});

// добавить JWT-токен в заголовки
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('auth-token') || useAuth.getState().token;
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// единый редирект на /login по 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);


const transformChannels = (channels: any[]): Channel[] => {
  return channels.map(channel => ({
    id: channel.ID || channel.id,
    guildId: channel.GuildID || channel.guildId,
    name: channel.Name || channel.name,
    type: channel.Type || channel.type,
    createdAt: channel.CreatedAt || channel.createdAt
  }));
};


export default api;

// === DTO Types ===
export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface ServerDto {
  name: string;
}

export interface ChannelDto {
  name: string;
  type: ChannelType;
}

// === Auth ===
export const auth = {
  login: (data: LoginUserDto): Promise<AxiosResponse<{ accessToken: string }>> =>
    api.post('/auth/login', data),

  register: (data: CreateUserDto): Promise<AxiosResponse<void>> =>
    api.post('/auth/register', data),
};

// === Guilds (Servers) ===
export const guild = {
  // GET  /guilds
  // Новая версия — совпадает с маршрутами в guild-service
  getGuilds: (): Promise<AxiosResponse<Guild[]>> =>
    api.get('/guilds'),
  createGuild: (data: ServerDto): Promise<AxiosResponse<Guild>> =>
    api.post('/guilds', data),
 inviteMember: (guildId: string, userId: string): Promise<AxiosResponse<void>> =>
    api.post(`/guilds/${guildId}/members`, { userId }),

  // GET  /guilds/:guildId/members
  getMembers: (guildId: string): Promise<AxiosResponse<User[]>> =>
    api.get(`/guilds/${guildId}/members`),

  // (опционально) POST /guilds/:guildId/members/:userId
  addMember: (guildId: string, userId: string): Promise<AxiosResponse<void>> =>
    api.post(`/guilds/${guildId}/members/${userId}`),

   createInvitation: (guildId: string): Promise<AxiosResponse<{ code: string }>> =>
    api.post(`/guilds/${guildId}/invites`),
  
  acceptInvitation: (code: string): Promise<AxiosResponse<void>> =>
    api.post(`/invites/${code}/accept`), 
  getInvitation: (code: string): Promise<AxiosResponse<{ guild: Guild }>> =>
    api.get(`/invitations/${code}`),
};

// === Channels ===


// Обновите метод getChannels в channelApi:
export const channel = {
  getChannels: (guildId: string): Promise<AxiosResponse<Channel[]>> =>
    api.get(`/guilds/${guildId}/channels`).then(response => {
      return {
        ...response,
        data: transformChannels(response.data)
      };
      
    }),
  createChannel: (guildId: string, data: ChannelDto): Promise<AxiosResponse<Channel>> =>
    api.post(`/guilds/${guildId}/channels`, data),
};


export const user = {
  getMe: (): Promise<AxiosResponse<User>> =>
    api.get('/users/me'),
  getById: (id: string): Promise<AxiosResponse<User>> =>
    api.get(`/users/${id}`),
};


// === Messages (Chat HTTP) ===
export const message = {
  // GET /channels/:channelId/messages?limit=&after=
  getMessages: (
    channelId: string,
    params?: { limit?: number; after?: string }
  ): Promise<AxiosResponse<Message[]>> =>
    api.get(`/channels/${channelId}/messages`, { params }),

  // NOTE: отправка сообщений идёт через WebSocket!
};
export type { 
  User, 
  Guild, 
  Channel, 
  Message, 
  ChannelType 
} from '../lib/generated';

export async function getMessages(channelId: string, limit = 50, after?: string): Promise<Message[]> {
    const response = await axios.get(`${API_URL}/channels/${channelId}/messages`, {
        params: { limit, after },
        headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    return response.data.map((msg: any) => {
        if (!msg.channelId || !msg.messageId || !msg.senderId) {
            console.warn("Invalid message data received:", msg);
            return {
                channelId: normalizeUUID(msg.channelId),
                messageId: normalizeUUID(msg.messageId),
                senderId: normalizeUUID(msg.senderId),
                content: msg.content || '',
                createdAt: new Date(msg.createdAt || Date.now()),
            };
        }
        return {
            channelId: normalizeUUID(msg.channelId),
            messageId: normalizeUUID(msg.messageId),
            senderId: normalizeUUID(msg.senderId),
            content: msg.content,
            createdAt: new Date(msg.createdAt),
        };
    });
}
export const getIceServers = async (): Promise<RTCIceServer[]> => {
  try {
    const response = await axios.get('/api/ice-servers');
    return response.data.iceServers;
  } catch (error) {
    console.error('Failed to get ICE servers', error);
    // Fallback to public STUN servers
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }
};
