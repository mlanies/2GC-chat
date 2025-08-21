import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../../shared';
import { sanitizeContent, sanitizeUsername } from '../utils/security';
import { MessageItem } from './MessageItem';
import { MessageListProps } from '../types/chat';

export function MessageList({ messages, currentUser, channelName }: MessageListProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [deletingMessages, setDeletingMessages] = useState<Set<string>>(new Set());

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

  // Автоматическая прокрутка при загрузке сообщений
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

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
    const removedMessages = Array.from(deletingMessages).filter(id => !currentMessageIds.has(id));
    
    if (removedMessages.length > 0) {
      const timer = setTimeout(() => {
        setDeletingMessages(prev => {
          const newSet = new Set(prev);
          removedMessages.forEach(id => newSet.delete(id));
          return newSet;
        });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [messages, deletingMessages]);

  return (
    <>
      <div className="messages-container" ref={messagesContainerRef}>
        <div className="messages-wrapper">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Начните общение в канале #{channelName}!</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                isOwnMessage={message.user === currentUser}
                isDeleting={deletingMessages.has(message.id)}
              />
            ))
          )}
        </div>
      </div>
      
      {showScrollButton && (
        <button 
          onClick={scrollToBottom}
          className="scroll-to-bottom-button"
          title="Прокрутить к последнему сообщению"
        >
          ↓
        </button>
      )}
    </>
  );
}
