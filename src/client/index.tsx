import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { ModernThemeProvider } from "./components/ModernThemeProvider";
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
  const [currentChannelId, setCurrentChannelId] = useState('general');
  const { room } = useParams();

    // Проверяем сохраненное состояние защиты от ботов при загрузке
  useEffect(() => {
    const botProtectionPassed = localStorage.getItem('bot_protection_passed');
    const botProtectionExpiry = localStorage.getItem('bot_protection_expiry');

    if (botProtectionPassed && botProtectionExpiry) {
      const expiryTime = parseInt(botProtectionExpiry);
      if (Date.now() < expiryTime) {
        // Защита от ботов уже пройдена и не истекла
      } else {
        localStorage.removeItem('bot_protection_passed');
        localStorage.removeItem('bot_protection_expiry');
      }
    }
  }, []);


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
      try {
        const message: Message = JSON.parse(evt.data as string);
        
        switch (message.type) {
          case 'auth_required':
            
            // Сохраняем ключи
            if (message.turnstileSiteKey) {
              setTurnstileSiteKey(message.turnstileSiteKey);
            }
            if (message.publicKey) {
              setPublicKey(message.publicKey);
            }
            if (message.keyExpiresAt) {
              setKeyExpiresAt(message.keyExpiresAt);
            }
            
            // Всегда проверяем токен сессии сначала
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
                    }
            
            // Если нет токена или токен недействителен, проверяем защиту от ботов
            if (message.botProtection) {
              // Проверяем, не проходили ли мы уже защиту от ботов
              const botProtectionPassed = localStorage.getItem('bot_protection_passed');
              const botProtectionExpiry = localStorage.getItem('bot_protection_expiry');
              
              if (botProtectionPassed && botProtectionExpiry) {
                const expiryTime = parseInt(botProtectionExpiry);
                if (Date.now() < expiryTime) {
                  // Защита от ботов уже пройдена и не истекла - показываем форму входа
                  setBotProtectionRequired(false);
                  setIsConnecting(false);
                  setIsAuthenticated(false);
                  return;
                } else {
                  // Защита от ботов истекла - очищаем состояние
                  localStorage.removeItem('bot_protection_passed');
                  localStorage.removeItem('bot_protection_expiry');
                }
              }
              
              // Защита от ботов включена и не пройдена - показываем компонент защиты
              setBotProtectionRequired(true);
              setIsConnecting(false);
            } else {
              // Защита от ботов отключена - показываем форму входа
              setIsConnecting(false);
              setIsAuthenticated(false);
            }
            break;
            
          case 'auth_success':
            setIsAuthenticated(true);
            setAuthError("");
            setMessages(message.messages || []);
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
            break;
            
          case 'auth_failed':
            setIsAuthenticated(false);
            setAuthError(message.error);
            setIsConnecting(false);
            setIsAutoLogin(false);
            setBotProtectionRequired(false);
            
            // Удаляем неверный cookie и состояние защиты от ботов
            removeSecureCookie('chat_session');
            removeSecureCookie('session_token');
            localStorage.removeItem('bot_protection_passed');
            localStorage.removeItem('bot_protection_expiry');
            break;
            
          case 'bot_protection_required':
            // Эта обработка теперь происходит в компоненте BotProtection
            break;
            
                    case 'bot_protection_success':
            setBotProtectionRequired(false);
            setIsConnecting(false);
            setIsAuthenticated(false);

            // Сохраняем состояние защиты от ботов на 1 час
            const expiryTime = Date.now() + (60 * 60 * 1000); // 1 час
            localStorage.setItem('bot_protection_passed', 'true');
            localStorage.setItem('bot_protection_expiry', expiryTime.toString());
            break;
            
          case 'bot_protection_failed':
            setAuthError(message.error);
            break;
            
          case 'push_notification':
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(message.title, {
                body: message.body,
                icon: message.icon,
                badge: message.icon,
                tag: 'chat-message',
                requireInteraction: false,
              });
            }
            break;
            
          case 'delete':
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
            break;
            
          case 'messages_cleaned':
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
            break;
            
          case 'add':
            // Проверяем, что сообщение для текущего канала
            const messageChannelId = (message as any).channelId || 'general';
            
            // Получаем текущий канал из состояния
            // По умолчанию используем 'general' если каналы не загружены
            const currentChannelId = channels.length > 0 ? 'general' : 'general';
            
            // Пока что принимаем все сообщения, фильтрация будет в компоненте
            const foundIndex = messages.findIndex((m) => m.id === message.id);
            
            if (foundIndex === -1) {
              // probably someone else who added a message
              setMessages((messages) => {
                const newMessage: ChatMessage = {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role as "user" | "assistant",
                  channelId: messageChannelId,
                };
                const newMessages = [...messages, newMessage];
                return newMessages;
              });
            } else {
              // this usually means we ourselves added a message
              // and it was broadcasted back
              // so let's replace the message with the new message
              setMessages((messages) => {
                const updatedMessage: ChatMessage = {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role as "user" | "assistant",
                  channelId: messageChannelId,
                };
                const updatedMessages = messages
                  .slice(0, foundIndex)
                  .concat(updatedMessage)
                  .concat(messages.slice(foundIndex + 1));
                return updatedMessages;
              });
            }
            break;
            
          case 'update':
            setMessages((messages) =>
              messages.map((m) =>
                m.id === message.id
                  ? {
                      id: message.id,
                      content: message.content,
                      user: message.user,
                      role: message.role as "user" | "assistant",
                      channelId: (message as any).channelId || 'general',
                    }
                  : m,
              ),
            );
            break;
            
          case 'all':
            setMessages(message.messages);
            break;
            
          case 'channel_create_success':
            // Обновляем список каналов
            setChannels(prev => [...prev, message.channel]);
            break;
            
          case 'channel_create_failed':
            // Можно показать уведомление об ошибке
            break;
            
          case 'channel_list':
            setChannels(message.channels || []);
            break;
            
          case 'channel_switch':
            setCurrentChannelId(message.channelId);
            setMessages(message.messages || []);
            break;
            
          case 'channel_switch_required':
            setCurrentChannelId(message.channelId);
            // Можно показать уведомление о причине переключения
            break;
            
          case 'channel_delete_success':
            // Каналы обновятся через channel_list
            break;
            
          case 'channel_delete_failed':
            // Можно показать уведомление об ошибке
            break;
            
          default:
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error parsing message:`, error, 'Raw data:', evt.data);
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
    localStorage.removeItem('bot_protection_passed');
    localStorage.removeItem('bot_protection_expiry');
    setIsAuthenticated(false);
    setMessages([]);
    setAuthError("");
    setSessionToken("");
  };

  const handleChannelSwitch = (channelId: string) => {
    setCurrentChannelId(channelId);
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
          onChannelSwitch={handleChannelSwitch}
          currentChannelId={currentChannelId}
        />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <ModernThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
        <Route path="/:room" element={<ChatApp />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </ModernThemeProvider>,
);
