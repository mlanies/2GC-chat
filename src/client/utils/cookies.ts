// Функции для работы с cookies
export const setSecureCookie = (name: string, value: string, days: number = 7) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Устанавливаем безопасные флаги (httponly должен устанавливаться на сервере)
  const cookieString = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;secure;samesite=strict`;
  
  document.cookie = cookieString;
};

export const getSecureCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      const value = c.substring(nameEQ.length, c.length);
      return decodeURIComponent(value);
    }
  }
  return null;
};

export const removeSecureCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;secure;samesite=strict`;
};

// Функция для проверки поддержки secure cookies
export const canSetSecureCookies = (): boolean => {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
};

// Функция для установки cookie с дополнительными параметрами безопасности
export const setSessionCookie = (name: string, value: string, options: {
  maxAge?: number;
  domain?: string;
  path?: string;
} = {}) => {
  const {
    maxAge = 7 * 24 * 60 * 60, // 7 дней по умолчанию
    domain,
    path = '/'
  } = options;
  
  let cookieString = `${name}=${encodeURIComponent(value)};max-age=${maxAge};path=${path}`;
  
  // Добавляем домен если указан
  if (domain) {
    cookieString += `;domain=${domain}`;
  }
  
  // Добавляем secure и samesite только для HTTPS
  if (canSetSecureCookies()) {
    cookieString += ';secure;samesite=strict';
  }
  
  document.cookie = cookieString;
};
