import React, { useRef, useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { ChatMessage, Message, Channel } from '../../shared';
import { sanitizeContent, sanitizeUsername } from '../utils/security';
import { ChannelsPanel } from './ChannelsPanel';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  name: string;
  socket: any;
  onLogout: () => void;
  isMobile: boolean;
  channels?: Channel[];
}

export function ChatInterface({ 
  messages, 
  name, 
  socket, 
  onLogout,
  isMobile,
  channels = []
}: ChatInterfaceProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [deletingMessages, setDeletingMessages] = React.useState<Set<string>>(new Set());
  const [currentChannelId, setCurrentChannelId] = useState('general');
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);
  const [showLifetimeNotice, setShowLifetimeNotice] = useState(true);

  // Функция для форматирования времени
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Функция для прокрутки к последнему сообщению
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  // Функция для проверки, нужно ли показать кнопку прокрутки
  const checkScrollPosition = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Автоматическая прокрутка только при загрузке сообщений
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, []);

  // Добавляем слушатель прокрутки
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, []);

  // Эффект для обработки удаления сообщений
  useEffect(() => {
    const currentMessageIds = new Set(messages.map(msg => msg.id));
    
    // Находим сообщения, которые были удалены
    const removedMessages = Array.from(deletingMessages).filter(id => !currentMessageIds.has(id));
    
    if (removedMessages.length > 0) {
      // Удаляем из состояния удаления через время анимации
      const timer = setTimeout(() => {
        setDeletingMessages(prev => {
          const newSet = new Set(prev);
          removedMessages.forEach(id => newSet.delete(id));
          return newSet;
        });
      }, 500); // Время анимации fadeOutDown
      
      return () => clearTimeout(timer);
    }
  }, [messages, deletingMessages]);

  // Фильтруем сообщения по текущему каналу
  const currentChannelMessages = messages.filter(msg => 
    !msg.channelId || msg.channelId === currentChannelId
  );

  const handleChannelSelect = (channelId: string) => {
    setCurrentChannelId(channelId);
  };

  const handleCreateChannel = (name: string, description: string) => {
    const newChannel: Channel = {
      id: `channel-${Date.now()}`,
      name,
      description,
      createdAt: Date.now(),
      createdBy: name,
    };
    
    // Отправляем сообщение о создании канала
    socket.send(JSON.stringify({
      type: "channel_create",
      channel: newChannel,
    }));
  };

  return (
    <div className="chat">
      {/* Заголовок чата */}
      <div className="chat-header">
        <div className="header-info">
          <h1>2GC Чат</h1>
          <p>Безопасное общение в реальном времени</p>
        </div>
        <button onClick={onLogout} className="logout-button">
          Выйти
        </button>
      </div>

      {/* Уведомление о времени жизни сообщений */}
      {showLifetimeNotice && (
        <div className="message-lifetime-notice">
          <div className="notice-icon">⏰</div>
          <div className="notice-text">
            <strong>Автоочистка:</strong> Сообщения автоматически удаляются через 2 минуты
          </div>
          <button
            className="close-notice-btn"
            onClick={() => setShowLifetimeNotice(false)}
            title="Закрыть уведомление"
          >
            ✕
          </button>
        </div>
      )}

      <div className="chat-content">
        {/* Панель каналов */}
        <ChannelsPanel
          channels={channels}
          currentChannelId={currentChannelId}
          onChannelSelect={handleChannelSelect}
          onCreateChannel={handleCreateChannel}
          isCollapsed={isChannelsCollapsed}
          onToggleCollapse={() => setIsChannelsCollapsed(!isChannelsCollapsed)}
        />

        {/* Основная область чата */}
        <div className="chat-main">
          {/* Заголовок текущего канала */}
          <div className="channel-header">
            <h2>#{channels.find(c => c.id === currentChannelId)?.name || 'general'}</h2>
          </div>

      {/* Мобильная кнопка выхода */}
      {isMobile && (
        <button onClick={onLogout} className="mobile-logout-button">
          Выйти
        </button>
      )}
      
          <div className="messages-container" ref={messagesContainerRef}>
            <div className="messages-wrapper">
              {currentChannelMessages.length === 0 ? (
                <div className="empty-state">
                  <p>Начните общение в канале #{channels.find(c => c.id === currentChannelId)?.name || 'general'}!</p>
                </div>
              ) : (
                currentChannelMessages.map((message) => {
                  const isOwnMessage = message.user === name;
                  const messageTime = formatTime(new Date());
                  const isDeleting = deletingMessages.has(message.id);
                  
                  return (
                    <div 
                      key={message.id} 
                      className={`message ${isOwnMessage ? 'own-message' : 'other-message'} ${isDeleting ? 'deleting' : ''}`}
                    >
                      <div className="user">{sanitizeUsername(message.user)}</div>
                      <div className="message-bubble">
                        <div className="content">{sanitizeContent(message.content)}</div>
                      </div>
                      <div className="message-time">{messageTime}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
      
      {/* Кнопка прокрутки вниз */}
      {showScrollButton && (
        <button 
          onClick={scrollToBottom}
          className="scroll-to-bottom-button"
          title="Прокрутить к последнему сообщению"
        >
          ↓
        </button>
      )}
      
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const content = e.currentTarget.elements.namedItem(
            "content",
          ) as HTMLInputElement;
          
          if (!content.value.trim()) return;
          
          const chatMessage: ChatMessage = {
            id: `${Date.now()}-${nanoid(8)}`,
            content: sanitizeContent(content.value),
            user: sanitizeUsername(name),
            role: "user",
            channelId: currentChannelId,
          };

          socket.send(
            JSON.stringify({
              type: "add",
              ...chatMessage,
            } satisfies Message),
          );

          content.value = "";
          
          // Прокручиваем к последнему сообщению после отправки
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }}
      >
        <div className="input-group">
          <input
            name="content"
            type="text"
            placeholder={`Сообщение в #${channels.find(c => c.id === currentChannelId)?.name || 'general'}...`}
            autoComplete="off"
            maxLength={500}
          />
          <button type="submit" className="send-message">Отправить</button>
        </div>
      </form>
        </div>
      </div>
    </div>
  );
}
