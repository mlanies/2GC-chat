export type ChatMessage = {
  id: string;
  user: string;
  role: "user" | "assistant";
  content: string;
  channelId?: string;
};

export type Channel = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
};

export type Message =
  | { type: "add"; id: string; user: string; role: "user" | "assistant"; content: string; channelId?: string }
  | { type: "update"; id: string; user: string; role: "user" | "assistant"; content: string; channelId?: string }
  | { type: "delete"; id: string; channelId?: string }
  | { type: "all"; messages: ChatMessage[]; channelId?: string }
  | { type: "auth_required"; botProtection?: boolean; turnstileSiteKey?: string; publicKey?: string; keyExpiresAt?: number }
  | { type: "auth_success"; messages: ChatMessage[]; sessionToken?: string; channels?: Channel[] }
  | { type: "auth_failed"; error: string }
  | { type: "push_notification"; title: string; body: string; icon: string }
  | { type: "messages_cleaned"; deletedCount: number; timestamp: number; deletedIds?: string[]; channelId?: string }
  | { type: "bot_protection_required"; challenge: any; sessionToken?: string }
  | { type: "bot_protection_success" }
  | { type: "bot_protection_failed"; error: string }
  | { type: "channel_create"; channel: Channel }
  | { type: "channel_switch"; channelId: string; messages: ChatMessage[] }
  | { type: "channel_list"; channels: Channel[] };

export type AuthMessage = {
  type: "auth";
  password?: string;
  sessionToken?: string;
};

export type BotProtectionMessage = {
  type: "turnstile_verify";
  token: string;
} | {
  type: "custom_challenge";
  answer: string;
};

export const names = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Kevin",
  "Linda",
  "Mallory",
  "Nancy",
  "Oscar",
  "Peggy",
  "Quentin",
  "Randy",
  "Steve",
  "Trent",
  "Ursula",
  "Victor",
  "Walter",
  "Xavier",
  "Yvonne",
  "Zoe",
];
