import type { Channel, ChatMessage } from "../../shared";

export function filterMessagesByChannel(messages: ChatMessage[], channelId: string): ChatMessage[] {
  return messages.filter(msg => 
    !msg.channelId || msg.channelId === channelId
  );
}

export function findChannelById(channels: Channel[], channelId: string): Channel | undefined {
  return channels.find(ch => ch.id === channelId);
}

export function findChannelByName(channels: Channel[], name: string): Channel | undefined {
  return channels.find(ch => ch.name === name);
}

export function createChannel(name: string, description: string, createdBy: string): Channel {
  return {
    id: `channel-${Date.now()}`,
    name,
    description,
    createdAt: Date.now(),
    createdBy,
  };
}

export function validateChannelName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 50;
}

export function sanitizeChannelName(name: string): string {
  return name.trim().substring(0, 50);
}
