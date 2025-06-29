// lib/generated.ts
export interface User {
  id: string; // Было: userId: any; id: string;
  username: string;
  email: string;
}

export interface Guild {
  ownerId: string;
  id: string;
  name: string;
}


export enum ChannelType {
  TEXT = 'TEXT',
  VOICE = 'VOICE'
}


export interface Message {
  channelId: string; // было gocql.UUID
  messageId: string; // было gocql.UUID
  senderId: string;
  content: string;
  createdAt: Date;
}

export interface Member {
  id: string;
  userId: string;
  guildId: string;
}

export interface Channel {
  id: string;
  guildId: string;
  name: string;
  type: ChannelType;
  createdAt?: string;
}