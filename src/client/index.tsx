import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message, type AuthMessage, type BotProtectionMessage, type Channel } from "../shared";
import { BotProtection } from "./components/BotProtection";
import { LoginForm } from "./components/LoginForm";
import { ChatInterface } from "./components/ChatInterface";
import { setSecureCookie, getSecureCookie, removeSecureCookie } from "./utils/cookies";
import { hashPassword, isSecureConnection, isKeyValid, sanitizeContent } from "./utils/security";
import { formatTime } from "./utils/format";





function ChatApp() {
  const [name] = useState(() => {
    // Генерируем уникальное имя с случайным суффиксом
    const baseName = names[Math.floor(Math.random() * names.length)];
    const suffix = Math.random().toString(36).substring(2, 6); // 4 случайных символа
    return `${baseName}#${suffix}`;
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isConnecting, setIsConnecting] = useState(true);
  const [isAutoLogin, setIsAutoLogin] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isMobile, setIsMobile] = useState(false);
  const [cleanupNotification, setCleanupNotification] = useState<{ count: number; timestamp: number } | null>(null);
  const [botProtectionRequired, setBotProtectionRequired] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>('');
  const [customChallenge, setCustomChallenge] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const [keyExpiresAt, setKeyExpiresAt] = useState<number>(0);
  const [sessionToken, setSessionToken] = useState<string>('');
  const { room } = useParams();



  // Проверка безопасности соединения
  useEffect(() => {
    if (!isSecureConnection()) {
      console.warn('Внимание: соединение не защищено HTTPS!');
    }
  }, []);

  // Запрос разрешения на push-уведомления
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Определение мобильного устройства
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);



  const socket = usePartySocket({
    party: "chat",
    room,
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      
      if (message.type === "auth_required") {
        // 1. Сохраняем ключи
        if (message.turnstileSiteKey) {
          setTurnstileSiteKey(message.turnstileSiteKey);
        }
        if (message.publicKey) {
          setPublicKey(message.publicKey);
        }
        if (message.keyExpiresAt) {
          setKeyExpiresAt(message.keyExpiresAt);
        }
        
        // 2. Проверяем токен сессии
        const savedToken = getSecureCookie('session_token');
        
        if (savedToken && !isAutoLogin) {
          // Пытаемся войти с токеном
          setIsAutoLogin(true);
          const authMessage: AuthMessage = {
            type: "auth",
            sessionToken: savedToken,
          };
          socket.send(JSON.stringify(authMessage));
          return;
        } else if (!savedToken && !isAutoLogin) {
          // Нет токена, проверяем защиту от ботов
          if (message.botProtection) {
            setBotProtectionRequired(true);
            setIsConnecting(false);
            return;
          } else {
            setIsConnecting(false);
            setIsAuthenticated(false);
          }
        }
        
        // 3. Если включена защита от ботов и мы не в состоянии autoLogin
        if (message.botProtection && !isAutoLogin) {
          setBotProtectionRequired(true);
          setIsConnecting(false);
          return;
        }
        
        // 4. Если защиты от ботов нет, проверяем сохраненный пароль
        if (!isAutoLogin) {
          const savedPassword = getSecureCookie('chat_session');
          if (savedPassword) {
            setIsAutoLogin(true);
            const authMessage: AuthMessage = {
              type: "auth",
              password: savedPassword,
            };
            socket.send(JSON.stringify(authMessage));
          } else {
            // Если нет сохраненного пароля, показываем форму входа
            setIsConnecting(false);
            setIsAuthenticated(false);
          }
        }
      } else if (message.type === "auth_success") {
        setIsAuthenticated(true);
        setAuthError("");
        setMessages(message.messages);
        setIsConnecting(false);
        setIsAutoLogin(false);
        setBotProtectionRequired(false);
        
        // Сохраняем каналы если есть
        if (message.channels) {
          setChannels(message.channels);
        }
        
        // Сохраняем токен сессии если есть
        if (message.sessionToken) {
          setSessionToken(message.sessionToken);
          setSecureCookie('session_token', message.sessionToken, 7);
        }
      } else if (message.type === "auth_failed") {
        setIsAuthenticated(false);
        setAuthError(message.error);
        setIsConnecting(false);
        setIsAutoLogin(false);
        setBotProtectionRequired(false);
        
        // Удаляем неверный cookie
        removeSecureCookie('chat_session');
      } else if (message.type === "bot_protection_required") {
        setBotProtectionRequired(true);
        setCustomChallenge(message.challenge);
        
        // Сохраняем токен сессии если есть
        if (message.sessionToken) {
          setSessionToken(message.sessionToken);
          setSecureCookie('session_token', message.sessionToken, 7);
        }
      } else if (message.type === "bot_protection_success") {
        setBotProtectionRequired(false);
        
        // Если пользователь уже аутентифицирован, показываем чат
        if (isAuthenticated) {
          // Ничего не делаем, пользователь уже в чате
        } else {
          // Пользователь прошел 2FA, но не аутентифицирован
          // Показываем форму входа
          setIsConnecting(false);
          setIsAuthenticated(false);
        }
      } else if (message.type === "bot_protection_failed") {
        setAuthError(message.error);
      } else if (message.type === "push_notification") {
        // Показываем push-уведомление
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(message.title, {
            body: message.body,
            icon: message.icon,
            badge: message.icon,
            tag: 'chat-message',
            requireInteraction: false,
          });
        }
      } else if (message.type === "delete") {
        // Добавляем сообщение в состояние удаления для анимации
        setMessages(prevMessages => {
          const messageToDelete = prevMessages.find(msg => msg.id === message.id);
          if (messageToDelete) {
            // Запускаем анимацию удаления
            setTimeout(() => {
              setMessages(currentMessages => 
                currentMessages.filter(msg => msg.id !== message.id)
              );
            }, 500); // Время анимации
          }
          return prevMessages;
        });
      } else if (message.type === "messages_cleaned") {
        // Уведомляем пользователя об очистке сообщений
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification("Сообщения очищены", {
            body: `Удалено ${message.deletedCount} старых сообщений`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: 'chat-cleanup',
            requireInteraction: false,
          });
        }
        
        // Показываем уведомление в интерфейсе
        setCleanupNotification({
          count: message.deletedCount,
          timestamp: message.timestamp
        });
        
        // Если есть список удаленных ID, удаляем их из состояния
        if (message.deletedIds && message.deletedIds.length > 0) {
          setMessages(prevMessages => 
            prevMessages.filter(msg => !message.deletedIds!.includes(msg.id))
          );
        }
        
        // Скрываем уведомление через 5 секунд
        setTimeout(() => {
          setCleanupNotification(null);
        }, 5000);
      } else if (message.type === "add") {
        const foundIndex = messages.findIndex((m) => m.id === message.id);
        if (foundIndex === -1) {
          // probably someone else who added a message
          setMessages((messages) => [
            ...messages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            },
          ]);
        } else {
          // this usually means we ourselves added a message
          // and it was broadcasted back
          // so let's replace the message with the new message
          setMessages((messages) => {
            return messages
              .slice(0, foundIndex)
              .concat({
                id: message.id,
                content: message.content,
                user: message.user,
                role: message.role,
              })
              .concat(messages.slice(foundIndex + 1));
          });
          

        }
      } else if (message.type === "update") {
        setMessages((messages) =>
          messages.map((m) =>
            m.id === message.id
              ? {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                }
              : m,
          ),
        );
      } else if (message.type === "all") {
        setMessages(message.messages);
      }
    },
    onOpen: () => {
      setIsConnecting(false);
    },
    onError: () => {
      setIsConnecting(false);
      setAuthError("Ошибка подключения к серверу");
    },
  });

  const handleLogin = async (password: string) => {
    const authMessage: AuthMessage = {
      type: "auth",
      password: password, // Пароль уже зашифрован в LoginForm
    };
    socket.send(JSON.stringify(authMessage));
    
    // Сохраняем сессию при успешном входе
    await handleSuccessfulLogin(password);
  };

  const handleSuccessfulLogin = async (password: string) => {
    // Сохраняем хеш пароля в защищенном cookie
    const hashedPassword = await hashPassword(password);
    setSecureCookie('chat_session', hashedPassword, 7); // 7 дней
  };

  const handleLogout = () => {
    removeSecureCookie('chat_session');
    removeSecureCookie('session_token');
    setIsAuthenticated(false);
    setMessages([]);
    setAuthError("");
    setSessionToken("");
  };

  if (isConnecting) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h3>2GC чат</h3>
          <p>{isAutoLogin ? 'Автоматический вход...' : 'Подключение к серверу...'}</p>
          <div className="loading" style={{ margin: '20px auto' }}></div>
        </div>
      </div>
    );
  }

  if (botProtectionRequired) {
    return (
      <BotProtection
        onSuccess={() => {
          setBotProtectionRequired(false);
          // После успешного прохождения защиты показываем форму входа
          setIsAuthenticated(false);
          setIsConnecting(false);
        }}
        turnstileSiteKey={turnstileSiteKey}
        challenge={customChallenge}
        socket={socket}
        error={authError}
        onErrorClear={() => setAuthError("")}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginForm 
        onLogin={handleLogin}
        authError={authError}
        isLoading={isConnecting}
        publicKey={publicKey}
        keyExpiresAt={keyExpiresAt}
      />
    );
  }

  return (
    <>
      {/* Уведомление об очистке сообщений */}
      {cleanupNotification && (
        <div className="cleanup-notification">
          <span>Удалено {cleanupNotification.count} старых сообщений</span>
        </div>
      )}
      
              <ChatInterface
          messages={messages}
          name={name}
          socket={socket}
          onLogout={handleLogout}
          isMobile={isMobile}
          channels={channels}
        />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
      <Route path="/:room" element={<ChatApp />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  </BrowserRouter>,
);
