import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message, AuthMessage, BotProtectionMessage, Channel } from "../shared";

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

  messages = [] as ChatMessage[];
  channels: Channel[] = [];
  authenticatedUsers = new Set<string>();
  verifiedUsers = new Set<string>(); // Пользователи, прошедшие защиту от ботов
  roomPassword = "secret123"; // Используем переменную окружения
  messageEncryptionKey = "your-secret-key-here"; // В продакшене используйте переменную окружения
  messageLifetime = 2 * 60 * 1000; // 2 минуты в миллисекундах
  cleanupInterval: number | null = null;
  
  // Настройки защиты от ботов (будут инициализированы в onStart)
  turnstileSiteKey = "";
  turnstileSecretKey = "";
  maxLoginAttempts = 3;
  loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

  // Ключи шифрования и токены
  encryptionKeys: EncryptionKeys | null = null;
  sessionTokens = new Map<string, SessionToken>();
  keyRotationInterval = 24 * 60 * 60 * 1000; // 24 часа
  tokenLifetime = 7 * 24 * 60 * 60 * 1000; // 7 дней
  
  // Задачи для защиты от ботов (по пользователям)
  userChallenges = new Map<string, { question: string; expectedAnswer: string; hint: string }>();

  // Генерация криптографически стойкого токена
  private generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/[^a-zA-Z0-9]/g, '');
  }

  // Генерация пары ключей RSA (упрощенная версия для демонстрации)
  private generateKeyPair(): EncryptionKeys {
    const now = Date.now();
    const expiresAt = now + this.keyRotationInterval;
    
    // Генерируем криптографически стойкий ключ длиной 32 байта (256 бит)
    const keyArray = new Uint8Array(32);
    crypto.getRandomValues(keyArray);
    const key = btoa(String.fromCharCode(...keyArray));
    
    return {
      publicKey: key,
      privateKey: key, // Используем тот же ключ для шифрования и расшифровки
      createdAt: now,
      expiresAt
    };
  }

  // Безопасное шифрование с использованием AES-GCM
  private async encryptWithAES(data: string, key: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);
      
      // Декодируем Base64 ключ и приводим к правильной длине
      let keyBytes: Uint8Array;
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      try {
        if (key && base64Regex.test(key)) {
          keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
        } else {
          // Fallback: используем UTF-8 байты ключа
          keyBytes = new TextEncoder().encode(key || "");
        }
      } catch {
        keyBytes = new TextEncoder().encode(key || "");
      }
      let finalKeyBytes = keyBytes;
      
      // Если ключ слишком короткий, дополняем его до 256 бит (32 байта)
      if (keyBytes.length < 32) {
        finalKeyBytes = new Uint8Array(32);
        finalKeyBytes.set(keyBytes);
        for (let i = keyBytes.length; i < 32; i++) {
          finalKeyBytes[i] = keyBytes[i % keyBytes.length];
        }
      } else if (keyBytes.length > 32) {
        // Если ключ слишком длинный, обрезаем его до 32 байт
        finalKeyBytes = keyBytes.slice(0, 32);
      }
      
      // Генерируем случайный IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Импортируем ключ
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        finalKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Шифруем данные
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encodedData
      );
      
      // Объединяем IV и зашифрованные данные
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('Encryption error:', error);
      return data; // Возвращаем исходные данные при ошибке
    }
  }

  // Расшифровка с использованием AES-GCM
  private async decryptWithAES(encryptedData: string, key: string): Promise<string> {
    try {
      // Проверяем, что encryptedData является корректным Base64
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }
      
      // Проверяем формат Base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(encryptedData)) {
        throw new Error('Invalid Base64 format');
      }
      
      // Декодируем данные
      const decoded = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
      
      // Проверяем минимальную длину (IV + данные)
      if (decoded.length < 13) {
        throw new Error('Encrypted data too short');
      }
      
      // Извлекаем IV (первые 12 байт)
      const iv = decoded.slice(0, 12);
      const encrypted = decoded.slice(12);
      
      // Декодируем Base64 ключ и приводим к правильной длине
      let keyBytes: Uint8Array;
      const base64RegexKey = /^[A-Za-z0-9+/]*={0,2}$/;
      try {
        if (key && base64RegexKey.test(key)) {
          keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
        } else {
          keyBytes = new TextEncoder().encode(key || "");
        }
      } catch {
        keyBytes = new TextEncoder().encode(key || "");
      }
      let finalKeyBytes = keyBytes;
      
      // Если ключ слишком короткий, дополняем его до 256 бит (32 байта)
      if (keyBytes.length < 32) {
        finalKeyBytes = new Uint8Array(32);
        finalKeyBytes.set(keyBytes);
        for (let i = keyBytes.length; i < 32; i++) {
          finalKeyBytes[i] = keyBytes[i % keyBytes.length];
        }
      } else if (keyBytes.length > 32) {
        // Если ключ слишком длинный, обрезаем его до 32 байт
        finalKeyBytes = keyBytes.slice(0, 32);
      }
      
      // Импортируем ключ
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        finalKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // Расшифровываем данные
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedData; // Возвращаем как есть при ошибке
    }
  }

  // Генерация токена сессии с улучшенной безопасностью
  private generateSessionToken(userId: string): SessionToken {
    const now = Date.now();
    const expiresAt = now + this.tokenLifetime;
    
    // Генерируем криптографически стойкий токен
    const token = this.generateSecureToken();
    
    return {
      token,
      userId,
      createdAt: now,
      expiresAt,
      isActive: true
    };
  }

  // Проверка токена сессии
  private validateSessionToken(token: string): boolean {
    const sessionToken = this.sessionTokens.get(token);
    if (!sessionToken) return false;
    
    const now = Date.now();
    if (now > sessionToken.expiresAt || !sessionToken.isActive) {
      this.sessionTokens.delete(token);
      return false;
    }
    
    return true;
  }

  // Очистка устаревших токенов
  private cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, sessionToken] of this.sessionTokens.entries()) {
      if (now > sessionToken.expiresAt) {
        this.sessionTokens.delete(token);
      }
    }
  }

  // Ротация ключей
  private rotateKeys() {
    const now = Date.now();
    if (!this.encryptionKeys || now > this.encryptionKeys.expiresAt) {
      this.encryptionKeys = this.generateKeyPair();
      console.log('Encryption keys rotated');
    }
  }

  // Безопасное хеширование паролей с использованием Web Crypto API
  private async hashPassword(password: string): Promise<string> {
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
    result.set(salt);
    result.set(new Uint8Array(hash), salt.length);
    
    return btoa(String.fromCharCode(...result));
  }

  // Проверка пароля
  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      
      // Проверяем, что hashedPassword является корректным Base64
      if (!hashedPassword || typeof hashedPassword !== 'string') {
        return false;
      }
      
      // Проверяем формат Base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(hashedPassword)) {
        return false;
      }
      
      // Декодируем сохраненный хеш
      const decoded = Uint8Array.from(atob(hashedPassword), c => c.charCodeAt(0));
      
      // Проверяем минимальную длину
      if (decoded.length < 20) {
        return false;
      }
      
      // Извлекаем соль (длина фиксированной соли 'durable-chat-salt-2024')
      const salt = decoded.slice(0, 20);
      
      // Импортируем ключ для PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        data,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      
      // Генерируем хеш с теми же параметрами
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
      
      // Сравниваем хеши
      const newHash = new Uint8Array(hash);
      const storedHash = decoded.slice(20);
      
      if (newHash.length !== storedHash.length) return false;
      
      return newHash.every((byte, index) => byte === storedHash[index]);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  // Простое шифрование сообщений (в продакшене используйте более надежные методы)
  private async encryptMessage(content: string): Promise<string> {
    try {
      // Проверяем, что ключ шифрования существует
      if (!this.messageEncryptionKey || this.messageEncryptionKey.length === 0) {
        return content;
      }
      
      // Шифруем сообщение с использованием AES-GCM
      return await this.encryptWithAES(content, this.messageEncryptionKey);
    } catch (error) {
      console.error('Message encryption error:', error);
      return content; // Возвращаем исходный контент при ошибке
    }
  }

  private async decryptMessage(encryptedContent: string): Promise<string> {
    try {
      // Проверяем, что ключ шифрования существует
      if (!this.messageEncryptionKey || this.messageEncryptionKey.length === 0) {
        return encryptedContent;
      }
      
      // Расшифровываем сообщение с использованием AES-GCM
      return await this.decryptWithAES(encryptedContent, this.messageEncryptionKey);
    } catch (error) {
      console.error('Message decryption error:', error);
      return encryptedContent; // Возвращаем как есть, если не удалось расшифровать
    }
  }

  // Генерация уникального токена сессии
  private generateSessionTokenOld(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return btoa(timestamp + random).replace(/[^a-zA-Z0-9]/g, '');
  }

  // Проверка Cloudflare Turnstile
  private async verifyTurnstile(token: string, clientIP: string): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append('secret', this.turnstileSecretKey);
      formData.append('response', token);
      formData.append('remoteip', clientIP);

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData
      });

      const result = await response.json() as { success: boolean };
      return result.success === true;
    } catch (error) {
      console.error('Turnstile verification error:', error);
      return false;
    }
  }

  // Генерация уникальной математической задачи
  private generateMathChallenge() {
    const operations = [
      { op: '+', name: 'сложение' },
      { op: '-', name: 'вычитание' },
      { op: '*', name: 'умножение' },
      { op: '/', name: 'деление' }
    ];
    
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let a: number, b: number, answer: number, question: string;
    
    switch (operation.op) {
      case '+':
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;
        answer = a + b;
        question = `Сколько будет ${a} + ${b}?`;
        break;
      case '-':
        a = Math.floor(Math.random() * 50) + 10;
        b = Math.floor(Math.random() * (a - 1)) + 1;
        answer = a - b;
        question = `Сколько будет ${a} - ${b}?`;
        break;
      case '*':
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        answer = a * b;
        question = `Сколько будет ${a} × ${b}?`;
        break;
      case '/':
        b = Math.floor(Math.random() * 10) + 2;
        answer = Math.floor(Math.random() * 10) + 1;
        a = b * answer;
        question = `Сколько будет ${a} ÷ ${b}?`;
        break;
      default:
        // Fallback для безопасности
        a = 5;
        b = 3;
        answer = a + b;
        question = `Сколько будет ${a} + ${b}?`;
        break;
    }
    
    return {
      type: "math",
      question,
      answer: answer.toString(),
      hint: `Простое ${operation.name}`
    };
  }

  // Генерация уникальной логической задачи
  private generateLogicChallenge() {
    const patterns = [
      {
        type: "arithmetic",
        generate: () => {
          const start = Math.floor(Math.random() * 10) + 1;
          const step = Math.floor(Math.random() * 5) + 1;
          const sequence = [start, start + step, start + step * 2, start + step * 3];
          const answer = start + step * 4;
          return {
            question: `Что дальше: ${sequence.join(', ')}?`,
            answer: answer.toString(),
            hint: `Арифметическая прогрессия с шагом ${step}`
          };
        }
      },
      {
        type: "geometric",
        generate: () => {
          const start = Math.floor(Math.random() * 5) + 1;
          const multiplier = Math.floor(Math.random() * 3) + 2;
          const sequence = [start, start * multiplier, start * multiplier * multiplier];
          const answer = start * multiplier * multiplier * multiplier;
          return {
            question: `Что дальше: ${sequence.join(', ')}?`,
            answer: answer.toString(),
            hint: `Геометрическая прогрессия с множителем ${multiplier}`
          };
        }
      },
      {
        type: "fibonacci",
        generate: () => {
          const a = Math.floor(Math.random() * 5) + 1;
          const b = Math.floor(Math.random() * 5) + 1;
          const c = a + b;
          const d = b + c;
          const answer = c + d;
          return {
            question: `Что дальше: ${a}, ${b}, ${c}, ${d}?`,
            answer: answer.toString(),
            hint: "Каждое число равно сумме двух предыдущих"
          };
        }
      }
    ];
    
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const result = pattern.generate();
    
    return {
      type: "logic",
      ...result
    };
  }

  // Генерация уникальной задачи на слова
  private generateWordChallenge() {
    const wordPairs = [
      { word: "горячий", opposite: "холодный", hint: "Температура" },
      { word: "большой", opposite: "маленький", hint: "Размер" },
      { word: "быстрый", opposite: "медленный", hint: "Скорость" },
      { word: "высокий", opposite: "низкий", hint: "Высота" },
      { word: "длинный", opposite: "короткий", hint: "Длина" },
      { word: "тяжелый", opposite: "легкий", hint: "Вес" },
      { word: "светлый", opposite: "темный", hint: "Освещение" },
      { word: "громкий", opposite: "тихий", hint: "Звук" },
      { word: "мягкий", opposite: "твердый", hint: "Твердость" },
      { word: "сухой", opposite: "мокрый", hint: "Влажность" }
    ];
    
    const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    
    // Случайно выбираем направление
    const isForward = Math.random() > 0.5;
    
    return {
      type: "word",
      question: isForward 
        ? `Противоположность слову '${pair.word}'?`
        : `Противоположность слову '${pair.opposite}'?`,
      answer: isForward ? pair.opposite : pair.word,
      hint: pair.hint
    };
  }

  // Генерация кастомной задачи
  private generateCustomChallenge(connectionId?: string) {
    const challengeTypes = [
      () => this.generateMathChallenge(),
      () => this.generateLogicChallenge(),
      () => this.generateWordChallenge()
    ];
    
    const generator = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    const challenge = generator();
    
    // Сохраняем задачу для пользователя
    if (connectionId) {
      this.userChallenges.set(connectionId, {
        question: challenge.question,
        expectedAnswer: challenge.answer,
        hint: challenge.hint
      });
    }
    
    return challenge;
  }

  // Проверка кастомной задачи
  private verifyCustomChallenge(answer: string, expectedAnswer: string): boolean {
    return answer.toLowerCase().trim() === expectedAnswer.toLowerCase().trim();
  }

  // Проверка лимита попыток входа
  private checkLoginAttempts(connectionId: string): boolean {
    const now = Date.now();
    const attempts = this.loginAttempts.get(connectionId);
    
    if (!attempts) {
      this.loginAttempts.set(connectionId, { count: 1, lastAttempt: now });
      return true;
    }

    // Сброс попыток через 15 минут
    if (now - attempts.lastAttempt > 15 * 60 * 1000) {
      this.loginAttempts.set(connectionId, { count: 1, lastAttempt: now });
      return true;
    }

    if (attempts.count >= this.maxLoginAttempts) {
      return false;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    return true;
  }

  // Очистка старых сообщений
  private cleanupOldMessages() {
    const now = Date.now();
    const cutoffTime = now - this.messageLifetime;
    
    // Фильтруем сообщения в памяти
    const oldMessages = this.messages.filter(msg => {
      const messageTime = parseInt(msg.id.split('-')[0]) || 0;
      return messageTime < cutoffTime;
    });
    
    if (oldMessages.length > 0) {
      // Собираем ID удаляемых сообщений
      const deletedIds = oldMessages.map(msg => msg.id);
      
      // Удаляем старые сообщения из памяти
      this.messages = this.messages.filter(msg => {
        const messageTime = parseInt(msg.id.split('-')[0]) || 0;
        return messageTime >= cutoffTime;
      });
      
      // Удаляем старые сообщения из базы данных
      oldMessages.forEach(msg => {
        this.ctx.storage.sql.exec(
          `DELETE FROM messages WHERE id = '${msg.id}'`
        );
      });
      
      // Отправляем уведомления об удалении каждого сообщения
      deletedIds.forEach(id => {
        this.broadcastMessage({
          type: "delete",
          id: id
        });
      });
      
      // Уведомляем всех клиентов об общей очистке
      this.broadcastMessage({
        type: "messages_cleaned",
        deletedCount: oldMessages.length,
        timestamp: now,
        deletedIds: deletedIds
      });
    }
  }

  // Запуск автоматической очистки
  private startCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Очищаем каждые 30 секунд
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMessages();
    }, 30000);
  }

  // Остановка автоматической очистки
  private stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  broadcastMessage(message: Message, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  async onStart() {
    // this is where you can initialize things that need to be done before the server starts
    // for example, load previous messages from a database or a service

    // Устанавливаем пароль из переменной окружения
    this.roomPassword = this.env.CHAT_PASSWORD || "secret123";

    // Инициализируем ключи Cloudflare Turnstile
    this.turnstileSiteKey = this.env.TURNSTILE_SITE_KEY || "0x4AAAAAABguUlIU3ucDAGUu";
    this.turnstileSecretKey = this.env.TURNSTILE_SECRET_KEY || "0x4AAAAAABguUqNdOD0VIPwoANOa2cI-HN0";

    // Инициализируем ключи шифрования
    this.rotateKeys();

    // create the messages table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT, encrypted INTEGER DEFAULT 1)`,
    );

    // create the session tokens table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS session_tokens (token TEXT PRIMARY KEY, user_id TEXT, created_at INTEGER, expires_at INTEGER, is_active INTEGER DEFAULT 1)`,
    );

    // create the channels table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, name TEXT, description TEXT, created_at INTEGER, created_by TEXT)`,
    );

    // load the messages from the database
    const rawMessages = this.ctx.storage.sql
      .exec(`SELECT * FROM messages`)
      .toArray() as any[];
    
    // Расшифровываем сообщения при загрузке
    this.messages = [];
    for (const msg of rawMessages) {
      const content = msg.encrypted ? await this.decryptMessage(msg.content) : msg.content;
      this.messages.push({
        id: msg.id,
        user: msg.user,
        role: msg.role,
        content: content,
        channelId: msg.channel_id || 'general',
      });
    }

    // load the channels from the database
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
      
      // Сохраняем в базу данных
      this.ctx.storage.sql.exec(
        `INSERT INTO channels (id, name, description, created_at, created_by) VALUES ('${generalChannel.id}', '${generalChannel.name}', '${generalChannel.description}', ${generalChannel.createdAt}, '${generalChannel.createdBy}')`
      );
    }

    // Загружаем активные токены сессий
    const rawTokens = this.ctx.storage.sql
      .exec(`SELECT * FROM session_tokens WHERE is_active = 1 AND expires_at > ${Date.now()}`)
      .toArray() as any[];
    
    rawTokens.forEach(token => {
      this.sessionTokens.set(token.token, {
        token: token.token,
        userId: token.user_id,
        createdAt: token.created_at,
        expiresAt: token.expires_at,
        isActive: token.is_active === 1
      });
    });

    // Запускаем автоматическую очистку старых сообщений
    this.startCleanupScheduler();
    
    // Запускаем ротацию ключей каждые 12 часов
    setInterval(() => {
      this.rotateKeys();
      this.cleanupExpiredTokens();
    }, 12 * 60 * 60 * 1000);
  }

  onConnect(connection: Connection) {
    // Ротация ключей при необходимости
    this.rotateKeys();
    
    // Принудительно включаем защиту от ботов
    const botProtectionEnabled = this.env.ENABLE_BOT_PROTECTION === "true" || true;
    
    // Отправляем информацию для аутентификации
    const authMessage = {
      type: "auth_required",
      botProtection: botProtectionEnabled,
      turnstileSiteKey: this.turnstileSiteKey,
      publicKey: this.encryptionKeys?.publicKey || '',
      keyExpiresAt: this.encryptionKeys?.expiresAt || 0,
    };
    
    connection.send(JSON.stringify(authMessage));
  }

  async authenticateUser(connection: Connection, encryptedPassword: string) {
    // Проверяем лимит попыток входа
    if (!this.checkLoginAttempts(connection.id)) {
      connection.send(
        JSON.stringify({
          type: "auth_failed",
          error: "Слишком много попыток входа. Попробуйте через 15 минут.",
        } satisfies Message),
      );
      return false;
    }

    let password: string;
    
    try {
      // Расшифровываем пароль с помощью закрытого ключа
      if (this.encryptionKeys) {
        password = await this.decryptWithAES(encryptedPassword, this.encryptionKeys.privateKey);
      } else {
        password = encryptedPassword;
      }
    } catch (error) {
      connection.send(
        JSON.stringify({
          type: "auth_failed",
          error: "Ошибка расшифровки пароля",
        } satisfies Message),
      );
      return false;
    }

    // Проверяем пароль
    if (password === this.roomPassword) {
      this.authenticatedUsers.add(connection.id);
      
      // Генерируем токен сессии
      const sessionToken = this.generateSessionToken(connection.id);
      this.sessionTokens.set(sessionToken.token, sessionToken);
      
      // Сохраняем токен в базе данных
      this.ctx.storage.sql.exec(
        `INSERT INTO session_tokens (token, user_id, created_at, expires_at, is_active) VALUES ('${sessionToken.token}', '${sessionToken.userId}', ${sessionToken.createdAt}, ${sessionToken.expiresAt}, 1)`
      );
      
      // Если включена защита от ботов и пользователь еще не прошел её, отправляем кастомную задачу
      const botProtectionEnabled = this.env.ENABLE_BOT_PROTECTION === "true" || true;
      if (botProtectionEnabled && !this.verifiedUsers.has(connection.id)) {
        const challenge = this.generateCustomChallenge(connection.id);
        connection.send(
          JSON.stringify({
            type: "bot_protection_required",
            challenge,
            sessionToken: sessionToken.token,
          } satisfies Message),
        );
        return true;
      } else {
        connection.send(
          JSON.stringify({
            type: "auth_success",
            messages: this.messages,
            sessionToken: sessionToken.token,
          } satisfies Message),
        );
        return true;
      }
    }
    
    // Проверяем хешированный пароль (для автоматического входа)
    const hashedPassword = await this.hashPassword(this.roomPassword);
    
    if (password === hashedPassword) {
      this.authenticatedUsers.add(connection.id);
      
      // Генерируем токен сессии
      const sessionToken = this.generateSessionToken(connection.id);
      this.sessionTokens.set(sessionToken.token, sessionToken);
      
      // Сохраняем токен в базе данных
      this.ctx.storage.sql.exec(
        `INSERT INTO session_tokens (token, user_id, created_at, expires_at, is_active) VALUES ('${sessionToken.token}', '${sessionToken.userId}', ${sessionToken.createdAt}, ${sessionToken.expiresAt}, 1)`
      );
      
      // Если включена защита от ботов и пользователь еще не прошел её, отправляем кастомную задачу
      const botProtectionEnabled = this.env.ENABLE_BOT_PROTECTION === "true" || true;
      if (botProtectionEnabled && !this.verifiedUsers.has(connection.id)) {
        const challenge = this.generateCustomChallenge(connection.id);
        connection.send(
          JSON.stringify({
            type: "bot_protection_required",
            challenge,
            sessionToken: sessionToken.token,
          } satisfies Message),
        );
        return true;
      } else {
        connection.send(
          JSON.stringify({
            type: "auth_success",
            messages: this.messages,
            sessionToken: sessionToken.token,
          } satisfies Message),
        );
        return true;
      }
    }
    
    // Неверный пароль
    connection.send(
      JSON.stringify({
        type: "auth_failed",
        error: "Неверный пароль",
      } satisfies Message),
    );
    return false;
  }

  // Обработка проверки Cloudflare Turnstile
  private async handleTurnstileVerification(connection: Connection, token: string) {
    try {
      // Получаем IP клиента (в реальном приложении нужно получить из заголовков)
      const clientIP = "127.0.0.1"; // Заглушка
      
      const isValid = await this.verifyTurnstile(token, clientIP);
      
      if (isValid) {
        // Отправляем кастомную задачу
        const challenge = this.generateCustomChallenge(connection.id);
        connection.send(
          JSON.stringify({
            type: "bot_protection_required",
            challenge,
          } satisfies Message),
        );
      } else {
        connection.send(
          JSON.stringify({
            type: "bot_protection_failed",
            error: "Проверка Cloudflare не пройдена",
          } satisfies Message),
        );
      }
    } catch (error) {
      connection.send(
        JSON.stringify({
          type: "bot_protection_failed",
          error: "Ошибка проверки",
        } satisfies Message),
      );
    }
  }

  // Обработка кастомной задачи
  private handleCustomChallenge(connection: Connection, answer: string) {
    const userChallenge = this.userChallenges.get(connection.id);
    
    if (this.verifyCustomChallenge(answer, userChallenge?.expectedAnswer || '')) {
      this.verifiedUsers.add(connection.id);
      
      // Отправляем успех защиты от ботов
      connection.send(JSON.stringify({
        type: "bot_protection_success"
      }));
      
      // Если пользователь уже аутентифицирован, отправляем сообщения чата
      if (this.authenticatedUsers.has(connection.id)) {
        connection.send(JSON.stringify({
          type: "auth_success",
          messages: this.messages,
          sessionToken: this.sessionTokens.get(connection.id)?.token || ''
        }));
      }
    } else {
      connection.send(JSON.stringify({
        type: "bot_protection_failed",
        error: "Неверный ответ на задачу"
      }));
    }
  }

  async saveMessage(message: ChatMessage) {
    // check if the message already exists
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }

    try {
      // Шифруем сообщение перед сохранением
      const encryptedContent = await this.encryptMessage(message.content);

      this.ctx.storage.sql.exec(
        `INSERT INTO messages (id, user, role, content) VALUES ('${message.id}', '${message.user}', '${message.role}', '${encryptedContent}') ON CONFLICT (id) DO UPDATE SET content = '${encryptedContent}'`
      );
    } catch (error) {
      throw error;
    }
  }

  async onMessage(connection: Connection, message: WSMessage) {
    const parsed = JSON.parse(message as string) as Message | AuthMessage | BotProtectionMessage;

    // Обработка аутентификации
    if (parsed.type === "auth") {
      if (parsed.sessionToken) {
        // Проверяем токен сессии
        if (this.validateSessionToken(parsed.sessionToken)) {
          // Токен валиден, аутентифицируем пользователя
          this.authenticatedUsers.add(connection.id);
                  connection.send(JSON.stringify({
          type: "auth_success",
          messages: this.messages.filter(msg => !msg.channelId || msg.channelId === 'general'),
          sessionToken: parsed.sessionToken,
          channels: this.channels
        }));
        } else {
          // Токен невалиден
          connection.send(JSON.stringify({
            type: "auth_failed",
            error: "Недействительный токен сессии"
          }));
        }
      } else if (parsed.password) {
        await this.authenticateUser(connection, parsed.password);
      } else {
        connection.send(JSON.stringify({
          type: "auth_failed",
          error: "Не указан пароль или токен сессии"
        }));
      }
      return;
    }

    // Обработка защиты от ботов
    if (parsed.type === "turnstile_verify") {
      this.handleTurnstileVerification(connection, parsed.token);
      return;
    }

    if (parsed.type === "custom_challenge") {
      this.handleCustomChallenge(connection, parsed.answer);
      return;
    }

    // Проверяем, аутентифицирован ли пользователь
    if (!this.authenticatedUsers.has(connection.id)) {
      const botProtectionEnabled = this.env.ENABLE_BOT_PROTECTION === "true" || true;
      
      // Если включена защита от ботов и пользователь не прошел её, отправляем уникальную задачу
      if (botProtectionEnabled && !this.verifiedUsers.has(connection.id)) {
        const challenge = this.generateCustomChallenge(connection.id);
        connection.send(
          JSON.stringify({
            type: "bot_protection_required",
            challenge,
          } satisfies Message),
        );
      } else {
        // Отправляем auth_required с информацией о защите от ботов
        connection.send(
          JSON.stringify({
            type: "auth_required",
            botProtection: botProtectionEnabled,
            turnstileSiteKey: this.turnstileSiteKey,
            publicKey: this.encryptionKeys?.publicKey || '',
            keyExpiresAt: this.encryptionKeys?.expiresAt || 0,
          } satisfies Message),
        );
      }
      return;
    }

    // Обработка сообщений чата
    if (parsed.type === "add" || parsed.type === "update") {
      try {
        await this.saveMessage(parsed);
        
        // Отправляем push-уведомление всем подключенным пользователям
        this.broadcastMessage({
          type: "push_notification",
          title: "Новое сообщение",
          body: `${parsed.user}: ${parsed.content}`,
          icon: "/favicon.ico",
        }, [connection.id]);
        
        // Отправляем сообщение всем пользователям (кроме отправителя)
        this.broadcastMessage(parsed, [connection.id]);
      } catch (error) {
        // Ошибка обрабатывается в saveMessage
      }
      return;
    }
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
