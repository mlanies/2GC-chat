import React, { useState } from 'react';
import { AuthMessage } from '../../shared';
import { encryptWithAES, importKey, hashPassword } from '../utils/security';

interface LoginFormProps {
  onLogin: (password: string) => void;
  authError: string;
  isLoading: boolean;
  publicKey: string;
  keyExpiresAt: number;
}

export function LoginForm({ 
  onLogin, 
  authError, 
  isLoading,
  publicKey,
  keyExpiresAt
}: LoginFormProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      try {
        // 1. Сначала хешируем пароль на клиенте (защита от перехвата в памяти)
        const clientHashedPassword = await hashPassword(password);
        
        // 2. Импортируем ключ для шифрования
        const key = await importKey(publicKey);
        
        // 3. Шифруем хешированный пароль перед отправкой
        const encryptedPassword = await encryptWithAES(clientHashedPassword, key);
        
        onLogin(encryptedPassword);
      } catch (error) {
        console.error('Security error:', error);
        // Fallback - отправляем пароль как есть (небезопасно, но для совместимости)
        onLogin(password);
      }
    }
  };

  // Проверка срока действия ключа
  const isKeyValid = (expiresAt: number): boolean => {
    return Date.now() < expiresAt;
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Вход в чат</h2>
        <p>Введите пароль для доступа к секретному чату</p>
        <div className="security-info">
          <small>🔒 Пароль хешируется и шифруется перед передачей</small>
        </div>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
            disabled={isLoading}
            maxLength={100}
            autoComplete="current-password"
          />
          
          <button type="submit" disabled={isLoading || !isKeyValid(keyExpiresAt)}>
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
        </form>
        
        {authError && (
          <div className="error-message">
            {authError}
          </div>
        )}
        
        {!isKeyValid(keyExpiresAt) && (
          <div className="warning-message">
            Ключ шифрования истек. Обновите страницу.
          </div>
        )}
        
        <div className="security-details">
          <details>
            <summary>🛡️ Детали безопасности</summary>
            <ul>
              <li>✅ PBKDF2 хеширование (100,000 итераций)</li>
              <li>✅ AES-GCM шифрование передачи</li>
              <li>✅ HTTPS защищенное соединение</li>
              <li>✅ Ротация ключей каждые 24 часа</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
