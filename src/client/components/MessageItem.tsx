import React from 'react';
import { ChatMessage } from '../../shared';
import { sanitizeContent, sanitizeUsername } from '../utils/security';
import { MessageItemProps } from '../types/chat';

export function MessageItem({ message, isOwnMessage, isDeleting }: MessageItemProps) {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div 
      className={`message ${isOwnMessage ? 'own-message' : 'other-message'} ${isDeleting ? 'deleting' : ''}`}
    >
      <div className="user">{sanitizeUsername(message.user)}</div>
      <div className="message-bubble">
        <div className="content">{sanitizeContent(message.content)}</div>
      </div>
      <div className="message-time">{formatTime(new Date())}</div>
    </div>
  );
}
