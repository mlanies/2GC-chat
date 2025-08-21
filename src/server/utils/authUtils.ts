import type { Connection } from "../../shared";

export interface SessionToken {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
}

export function generateSessionToken(userId: string, lifetime: number = 7 * 24 * 60 * 60 * 1000): SessionToken {
  const now = Date.now();
  const expiresAt = now + lifetime;
  
  // Генерируем криптографически стойкий токен
  const token = generateSecureToken();
  
  return {
    token,
    userId,
    createdAt: now,
    expiresAt,
    isActive: true
  };
}

export function validateSessionToken(token: string, sessionTokens: Map<string, SessionToken>): boolean {
  const sessionToken = sessionTokens.get(token);
  if (!sessionToken) return false;
  
  const now = Date.now();
  if (now > sessionToken.expiresAt || !sessionToken.isActive) {
    sessionTokens.delete(token);
    return false;
  }
  
  return true;
}

export function cleanupExpiredTokens(sessionTokens: Map<string, SessionToken>): void {
  const now = Date.now();
  for (const [token, sessionToken] of sessionTokens.entries()) {
    if (now > sessionToken.expiresAt) {
      sessionTokens.delete(token);
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Используем фиксированную соль для совместимости с клиентом
  const salt = new TextEncoder().encode('durable-chat-salt-2024');
  
  // Импортируем ключ для PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // Генерируем хеш с помощью PBKDF2
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Объединяем соль и хеш
  const result = new Uint8Array(salt.length + hash.byteLength);
  result.set(salt, 0);
  result.set(new Uint8Array(hash), salt.length);
  
  return btoa(String.fromCharCode(...result));
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
