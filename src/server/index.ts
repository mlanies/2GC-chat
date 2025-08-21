import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";
import type { ChatMessage, Message, AuthMessage, BotProtectionMessage, Channel } from "../shared";
import { handleAuthMessage, handleChatMessage, handleChannelCreate, handleChannelSwitch, handleChannelDelete, type MessageHandlerContext } from "./handlers/messageHandlers";
import { filterMessagesByChannel, findChannelByName, createChannel, validateChannelName } from "./utils/channelUtils";
import { generateSessionToken, validateSessionToken, cleanupExpiredTokens, hashPassword, type SessionToken as AuthSessionToken } from "./utils/authUtils";
import { verifyTurnstileToken, getTurnstileErrorMessage } from "./utils/turnstileUtils";

// Интерфейс для ключей шифрования
interface EncryptionKeys {
  publicKey: string;
  privateKey: string;
  createdAt: number;
  expiresAt: number;
}

// Интерфейс для токенов сессии
interface SessionToken {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  isActive: boolean;
}

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  private authenticatedUsers = new Set<string>();
  private verifiedUsers = new Set<string>();
  private botProtectionTokens = new Map<string, string>();
  private sessionTokens = new Map<string, AuthSessionToken>();
  private userChannels = new Map<string, string>(); // Отслеживаем текущий канал для каждого пользователя
  
  roomPassword = "password123";
  messageEncryptionKey = "your-secret-key-here";
  tokenLifetime = 7 * 24 * 60 * 60 * 1000; // 7 дней
  turnstileSiteKey = "0x4AAAAAABguUlIU3ucDAGUu";
  turnstileSecretKey = "0x4AAAAAABguUqNdOD0VIPwoANOa2cI-HN0";
  encryptionKeys: EncryptionKeys | null = null;
  messages: ChatMessage[] = [];
  channels: Channel[] = [];

  async onMessage(connection: Connection, message: WSMessage) {
    console.log(`[${new Date().toISOString()}] Received message from ${connection.id}:`, message);
    
    try {
      const parsed = JSON.parse(message as string);
      console.log(`[${new Date().toISOString()}] Parsed message type: ${parsed.type}`);
      
      // Проверяем аутентификацию для всех сообщений кроме auth и bot protection
      if (parsed.type !== "auth" && parsed.type !== "turnstile_verify" && parsed.type !== "custom_challenge") {
        if (!this.authenticatedUsers.has(connection.id)) {
          console.log(`[${new Date().toISOString()}] Unauthenticated user ${connection.id} tried to send message type: ${parsed.type}`);
          connection.send(JSON.stringify({
            type: "auth_required",
            botProtection: this.env.ENABLE_BOT_PROTECTION === "true" || true,
            turnstileSiteKey: this.turnstileSiteKey,
            publicKey: this.encryptionKeys?.publicKey || '',
            keyExpiresAt: this.encryptionKeys?.expiresAt || 0,
          }));
          return;
        }
      }

      // Создаем контекст для обработчиков
      const context: MessageHandlerContext = {
        connection,
        messages: this.messages,
        channels: this.channels,
        userChannels: this.userChannels,
        authenticatedUsers: this.authenticatedUsers,
        verifiedUsers: this.verifiedUsers,
        broadcastMessage: this.broadcastMessage.bind(this),
        sendToConnection: (message) => connection.send(JSON.stringify(message)),
        ctx: this.ctx,
        saveMessage: this.saveMessage.bind(this),
        validateSessionToken: (token) => validateSessionToken(token, this.sessionTokens),
        authenticateUser: this.authenticateUser.bind(this),
        handleTurnstileVerification: this.handleTurnstileVerification.bind(this),
        handleCustomChallenge: this.handleCustomChallenge.bind(this),
        generateCustomChallenge: this.generateCustomChallenge.bind(this),
        env: this.env,
      };

      // Обработка аутентификации
      if (parsed.type === "auth") {
        await handleAuthMessage(parsed, context);
        return;
      }

      // Обработка защиты от ботов
      if (parsed.type === "turnstile_verify") {
        await this.handleTurnstileVerification(connection, parsed.token);
        return;
      }

      if (parsed.type === "custom_challenge") {
        this.handleCustomChallenge(connection, parsed.answer);
        return;
      }

      // Обработка сообщений чата
      if (parsed.type === "add" || parsed.type === "update") {
        console.log(`[${new Date().toISOString()}] Processing chat message:`, parsed.type, parsed.id);
        await handleChatMessage(parsed, context);
        return;
      }

      // Обработка создания каналов
      if (parsed.type === "channel_create") {
        await handleChannelCreate(parsed, context);
        return;
      }

      // Обработка переключения каналов
      if (parsed.type === "channel_switch") {
        await handleChannelSwitch(parsed, context);
        return;
      }

      // Обработка удаления каналов
      if (parsed.type === "channel_delete") {
        await handleChannelDelete(parsed, context);
        return;
      }
      
      console.log(`[${new Date().toISOString()}] Unknown message type: ${parsed.type}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing message:`, error);
    }
  }

  // Методы для работы с сообщениями
  async saveMessage(message: any) {
    const content = await this.encryptMessage(message.content);
    
    // Сохраняем в базу данных
    this.ctx.storage.sql.exec(
      `INSERT INTO messages (id, user, role, content, encrypted, channel_id) VALUES ('${message.id}', '${message.user}', '${message.role}', '${content}', 1, '${message.channelId || 'general'}')`
    );
    
    // Добавляем в память
    this.messages.push({
      id: message.id,
      user: message.user,
      role: message.role,
      content: message.content,
      channelId: message.channelId || 'general',
    });
  }

  // Методы для broadcast
  broadcastMessage(message: Message, exclude?: string[], targetChannelId?: string) {
    const connections = Array.from(this.getConnections());
    console.log(`[${new Date().toISOString()}] Broadcasting message:`, {
      type: message.type,
      exclude: exclude || [],
      totalConnections: connections.length,
      excludedConnections: exclude?.length || 0,
      messageChannelId: (message as any).channelId || 'none',
      targetChannelId: targetChannelId || 'all'
    });
    
    const messageString = JSON.stringify(message);
    console.log(`[${new Date().toISOString()}] Message JSON:`, messageString);
    
    this.broadcast(messageString, exclude, targetChannelId);
    console.log(`[${new Date().toISOString()}] Message broadcasted successfully`);
  }

  broadcast(message: string, exclude?: string[], targetChannelId?: string) {
    const connections = Array.from(this.getConnections());
    console.log(`[${new Date().toISOString()}] Broadcasting to ${connections.length} connections, excluding:`, exclude || [], 'targetChannelId:', targetChannelId || 'all');
    
    for (const connection of connections) {
      if (exclude && exclude.includes(connection.id)) {
        console.log(`[${new Date().toISOString()}] Skipping excluded connection: ${connection.id}`);
        continue;
      }
      
      // Если указан targetChannelId, отправляем только пользователям в этом канале
      if (targetChannelId) {
        const userChannel = this.userChannels.get(connection.id);
        if (userChannel !== targetChannelId) {
          console.log(`[${new Date().toISOString()}] Skipping connection ${connection.id} (channel: ${userChannel}, target: ${targetChannelId})`);
          continue;
        }
      }
      
      // Проверяем, аутентифицирован ли клиент
      const isAuthenticated = this.authenticatedUsers.has(connection.id);
      console.log(`[${new Date().toISOString()}] Sending to connection: ${connection.id}, authenticated: ${isAuthenticated}`);
      connection.send(message);
    }
    
    console.log(`[${new Date().toISOString()}] Broadcast completed`);
  }

  // Методы для аутентификации
  async authenticateUser(connection: Connection, encryptedPassword: string) {
    console.log(`[${new Date().toISOString()}] Authenticating user ${connection.id}`);
    console.log(`[${new Date().toISOString()}] Expected password: ${this.roomPassword}`);
    console.log(`[${new Date().toISOString()}] Received encrypted password: ${encryptedPassword.substring(0, 50)}...`);
    
    try {
      console.log(`[${new Date().toISOString()}] Decrypting password with encryption keys`);
      const decryptedPassword = await this.decryptMessage(encryptedPassword);
      console.log(`[${new Date().toISOString()}] Decrypted password: ${decryptedPassword}`);
      console.log(`[${new Date().toISOString()}] Comparing passwords: "${decryptedPassword}" === "${this.roomPassword}"`);
      
      // Сравниваем с хешированным паролем
      const hashedPassword = await hashPassword(this.roomPassword);
      console.log(`[${new Date().toISOString()}] Comparing with hashed password: "${decryptedPassword}" === "${hashedPassword}"`);
      
      if (decryptedPassword === hashedPassword) {
        console.log(`[${new Date().toISOString()}] Hashed password correct!`);
        
        // Аутентифицируем пользователя
        this.authenticatedUsers.add(connection.id);
        
        // Генерируем токен сессии
        const sessionToken = generateSessionToken(connection.id, this.tokenLifetime);
        this.sessionTokens.set(sessionToken.token, sessionToken);
        
        // Устанавливаем канал по умолчанию
        this.userChannels.set(connection.id, 'general');
        
        // Отправляем успешную аутентификацию
        connection.send(JSON.stringify({
          type: "auth_success",
          messages: this.messages.filter(msg => !msg.channelId || msg.channelId === 'general'),
          sessionToken: sessionToken.token,
          channels: this.channels
        }));
        
        console.log(`[${new Date().toISOString()}] Auth message sent to ${connection.id}`);
      } else {
        console.log(`[${new Date().toISOString()}] Password incorrect`);
        connection.send(JSON.stringify({
          type: "auth_failed",
          error: "Неверный пароль"
        }));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Authentication error:`, error);
      connection.send(JSON.stringify({
        type: "auth_failed",
        error: "Ошибка аутентификации"
      }));
    }
  }

  // Методы для защиты от ботов
  async handleTurnstileVerification(connection: Connection, token: string) {
    console.log(`[${new Date().toISOString()}] Turnstile verification for ${connection.id}`);
    
    try {
      // Проверяем токен через Cloudflare Turnstile API
      const result = await verifyTurnstileToken(token, this.turnstileSecretKey);
      
      if (result.success) {
        console.log(`[${new Date().toISOString()}] Turnstile verification successful for ${connection.id}`);
        
        // Генерируем кастомную задачу
        const challenge = this.generateCustomChallenge(connection.id);
        
        connection.send(JSON.stringify({
          type: "bot_protection_required",
          challenge: challenge
        }));
      } else {
        console.log(`[${new Date().toISOString()}] Turnstile verification failed for ${connection.id}:`, result['error-codes']);
        
        const errorMessage = getTurnstileErrorMessage(result['error-codes'] || []);
        connection.send(JSON.stringify({
          type: "bot_protection_failed",
          error: errorMessage
        }));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Turnstile verification error for ${connection.id}:`, error);
      
      connection.send(JSON.stringify({
        type: "bot_protection_failed",
        error: "Ошибка проверки Turnstile"
      }));
    }
  }

  handleCustomChallenge(connection: Connection, answer: string) {
    console.log(`[${new Date().toISOString()}] Custom challenge for ${connection.id}: ${answer}`);
    
    // Получаем сохраненный вызов для этого соединения
    const savedChallenge = this.botProtectionTokens.get(connection.id);
    
    if (!savedChallenge) {
      console.log(`[${new Date().toISOString()}] No saved challenge for ${connection.id}`);
      connection.send(JSON.stringify({
        type: "bot_protection_failed",
        error: "Вызов не найден"
      }));
      return;
    }
    
    try {
      const challenge = JSON.parse(savedChallenge);
      
      // Проверяем ответ
      if (answer.toLowerCase().trim() === challenge.answer.toLowerCase().trim()) {
        console.log(`[${new Date().toISOString()}] Custom challenge successful for ${connection.id}`);
        this.verifiedUsers.add(connection.id);
        this.botProtectionTokens.delete(connection.id);
        
        // Отправляем успех и показываем форму входа
        connection.send(JSON.stringify({
          type: "bot_protection_success"
        }));
      } else {
        console.log(`[${new Date().toISOString()}] Custom challenge failed for ${connection.id}: expected "${challenge.answer}", got "${answer}"`);
        
        connection.send(JSON.stringify({
          type: "bot_protection_failed",
          error: "Неверный ответ"
        }));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error parsing challenge for ${connection.id}:`, error);
      
      connection.send(JSON.stringify({
        type: "bot_protection_failed",
        error: "Ошибка обработки вызова"
      }));
    }
  }

  generateCustomChallenge(connectionId: string) {
    const challenges = [
      {
        type: "logic",
        question: "Что дальше: 9, 11, 13, 15?",
        answer: "17",
        hint: "Арифметическая прогрессия с шагом 2"
      },
      {
        type: "word",
        question: "Противоположность слову 'сухой'?",
        answer: "мокрый",
        hint: "Влажность"
      },
      {
        type: "math",
        question: "Сколько будет 7 × 8?",
        answer: "56",
        hint: "Таблица умножения"
      },
      {
        type: "logic",
        question: "Какое число пропущено: 2, 4, 8, 16, ?",
        answer: "32",
        hint: "Каждое число умножается на 2"
      }
    ];
    
    const challenge = challenges[Math.floor(Math.random() * challenges.length)];
    
    // Сохраняем вызов для этого соединения
    this.botProtectionTokens.set(connectionId, JSON.stringify(challenge));
    
    return challenge;
  }

  // Методы для шифрования
  async encryptMessage(content: string): Promise<string> {
    if (!this.encryptionKeys) {
      this.rotateKeys();
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    
    const key = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(atob(this.encryptionKeys!.publicKey).split('').map(c => c.charCodeAt(0))),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...result));
  }

  async decryptMessage(encryptedData: string): Promise<string> {
    try {
      const data = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);
      
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(atob(this.encryptionKeys!.publicKey).split('').map(c => c.charCodeAt(0))),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData; // Возвращаем как есть при ошибке
    }
  }

  rotateKeys() {
    const now = Date.now();
    if (!this.encryptionKeys || now > this.encryptionKeys.expiresAt) {
      this.encryptionKeys = this.generateKeyPair();
      console.log('Encryption keys rotated');
    }
  }

  generateKeyPair(): EncryptionKeys {
    const key = crypto.getRandomValues(new Uint8Array(32));
    return {
      publicKey: btoa(String.fromCharCode(...key)),
      privateKey: btoa(String.fromCharCode(...key)),
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 часа
    };
  }

  // Методы жизненного цикла
  async onStart() {
    console.log(`[${new Date().toISOString()}] Server starting...`);
    
    this.roomPassword = this.env.CHAT_PASSWORD || "password123";
    console.log(`[${new Date().toISOString()}] Room password set to: ${this.roomPassword}`);
    console.log(`[${new Date().toISOString()}] Environment CHAT_PASSWORD: ${this.env.CHAT_PASSWORD}`);

    this.turnstileSiteKey = this.env.TURNSTILE_SITE_KEY || "0x4AAAAAABguUlIU3ucDAGUu";
    this.turnstileSecretKey = this.env.TURNSTILE_SECRET_KEY || "0x4AAAAAABguUqNdOD0VIPwoANOa2cI-HN0";

    this.rotateKeys();

    // Создаем таблицы
    this.ctx.storage.sql.exec(
      `DROP TABLE IF EXISTS messages`
    );
    
    this.ctx.storage.sql.exec(
      `CREATE TABLE messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT, encrypted INTEGER DEFAULT 1, channel_id TEXT DEFAULT 'general')`
    );

    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS session_tokens (token TEXT PRIMARY KEY, user_id TEXT, created_at INTEGER, expires_at INTEGER, is_active INTEGER DEFAULT 1)`
    );

    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT, description TEXT, created_at INTEGER, created_by TEXT)`
    );

    // Загружаем сообщения
    const rawMessages = this.ctx.storage.sql
      .exec(`SELECT * FROM messages`)
      .toArray() as any[];
    
    this.messages = [];
    for (const msg of rawMessages) {
      try {
        let content = msg.content;
        if (msg.encrypted) {
          content = await this.decryptMessage(msg.content);
        }
        this.messages.push({
          id: msg.id,
          user: msg.user,
          role: msg.role,
          content: content,
          channelId: msg.channel_id || 'general',
        });
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error decrypting message ${msg.id}:`, error);
        // Если не удается расшифровать, пропускаем сообщение
      }
    }

    // Загружаем каналы
    const rawChannels = this.ctx.storage.sql
      .exec(`SELECT * FROM channels`)
      .toArray() as any[];
    
    this.channels = rawChannels.map(channel => ({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      createdAt: channel.created_at,
      createdBy: channel.created_by,
    }));

    // Создаем общий канал, если каналов нет
    if (this.channels.length === 0) {
      const generalChannel: Channel = {
        id: 'general',
        name: 'Общий',
        description: 'Основной канал для общения',
        createdAt: Date.now(),
        createdBy: 'system',
      };
      this.channels.push(generalChannel);
      
      this.ctx.storage.sql.exec(
        `INSERT INTO channels (id, name, description, created_at, created_by) VALUES ('${generalChannel.id}', '${generalChannel.name}', '${generalChannel.description}', ${generalChannel.createdAt}, '${generalChannel.createdBy}')`
      );
    }

    // Запускаем очистку токенов
    setInterval(() => {
      cleanupExpiredTokens(this.sessionTokens);
    }, 60 * 1000); // Каждую минуту
  }

  onConnect(connection: Connection) {
    console.log(`[${new Date().toISOString()}] New connection: ${connection.id}`);
    
    const botProtectionEnabled = this.env.ENABLE_BOT_PROTECTION === "true" || true;
    console.log(`[${new Date().toISOString()}] Bot protection enabled: ${botProtectionEnabled}`);
    
    const authMessage = {
      type: 'auth_required',
      botProtection: botProtectionEnabled,
      turnstileSiteKey: this.turnstileSiteKey,
      publicKey: this.encryptionKeys?.publicKey || '',
      keyExpiresAt: this.encryptionKeys?.expiresAt || 0,
    };
    
    console.log(`[${new Date().toISOString()}] Sending auth_required to ${connection.id}:`, authMessage);
    connection.send(JSON.stringify(authMessage));
    console.log(`[${new Date().toISOString()}] Auth message sent to ${connection.id}`);
  }

  onClose(connection: Connection) {
    const connectionId = connection.id;
    console.log(`[${new Date().toISOString()}] Connection closed: ${connectionId}`);
    
    // Remove from authenticated users
    this.authenticatedUsers.delete(connectionId);
    
    // Remove from bot protection tokens
    this.botProtectionTokens.delete(connectionId);
    
    // Remove from user channels
    this.userChannels.delete(connectionId);
    
    // Remove from verified users
    this.verifiedUsers.delete(connectionId);
    
    console.log(`[${new Date().toISOString()}] Connection ${connectionId} cleaned up`);
  }
}

export default {
  async fetch(request, env) {
    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;