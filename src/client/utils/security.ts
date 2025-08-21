// Безопасное хеширование паролей с использованием Web Crypto API
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Используем фиксированную соль для совместимости с сервером
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
};

// Проверка пароля
export const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Декодируем сохраненный хеш
    const decoded = Uint8Array.from(atob(hashedPassword), c => c.charCodeAt(0));
    
    // Извлекаем соль (первые 16 байт)
    const salt = decoded.slice(0, 16);
    
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
    const storedHash = decoded.slice(16);
    
    if (newHash.length !== storedHash.length) return false;
    
    return newHash.every((byte, index) => byte === storedHash[index]);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

// Улучшенная функция для очистки контента от потенциально опасных элементов
export const sanitizeContent = (content: string): string => {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Удаляем HTML теги
  let sanitized = content.replace(/<[^>]*>/g, '');
  
  // Удаляем потенциально опасные JavaScript события
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Удаляем javascript: протоколы
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Удаляем data: протоколы (может содержать вредоносный код)
  sanitized = sanitized.replace(/data:/gi, '');
  
  // Удаляем vbscript: протоколы
  sanitized = sanitized.replace(/vbscript:/gi, '');
  
  // Экранируем специальные символы
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Ограничиваем длину
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  return sanitized.trim();
};

// Дополнительная валидация для имен пользователей
export const sanitizeUsername = (username: string): string => {
  if (!username || typeof username !== 'string') {
    return 'Anonymous';
  }
  
  // Удаляем HTML теги и специальные символы
  let sanitized = username.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/[^\w\sа-яёА-ЯЁ-]/g, '');
  
  // Ограничиваем длину
  if (sanitized.length > 20) {
    sanitized = sanitized.substring(0, 20);
  }
  
  // Если имя пустое, возвращаем Anonymous
  return sanitized.trim() || 'Anonymous';
};

// Функция для проверки безопасности соединения
export const isSecureConnection = (): boolean => {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

// Безопасное шифрование с использованием AES-GCM
export const encryptWithAES = async (data: string, key: CryptoKey): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    
    // Генерируем случайный IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Шифруем данные
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // Объединяем IV и зашифрованные данные
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Расшифровка с использованием AES-GCM
export const decryptWithAES = async (encryptedData: string, key: CryptoKey): Promise<string> => {
  try {
    // Декодируем данные
    const decoded = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Извлекаем IV (первые 12 байт)
    const iv = decoded.slice(0, 12);
    const encrypted = decoded.slice(12);
    
    // Расшифровываем данные
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

// Генерация ключа шифрования
export const generateEncryptionKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
};

// Экспорт ключа для передачи
export const exportKey = async (key: CryptoKey): Promise<string> => {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Импорт ключа
export const importKey = async (keyData: string): Promise<CryptoKey> => {
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

// Проверка срока действия ключа
export const isKeyValid = (expiresAt: number): boolean => {
  return Date.now() < expiresAt;
};
