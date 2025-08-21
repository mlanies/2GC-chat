import React from 'react';
import { ChatHeaderProps } from '../types/chat';

export function ChatHeader({ onLogout, isMobile }: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <div className="header-info">
        <h1>2GC Чат</h1>
        <p>Безопасное общение в реальном времени</p>
        <div className="auto-cleanup-notice">
          <span className="notice-icon">⏰</span>
          <span className="notice-text">
            <strong>Автоочистка:</strong> Сообщения автоматически удаляются через 2 минуты
          </span>
        </div>
      </div>
      <div className="header-actions">
        {!isMobile && (
          <button onClick={onLogout} className="logout-button">
            Выйти
          </button>
        )}
      </div>
    </div>
  );
}
