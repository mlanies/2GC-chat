import React, { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  lastMessageTime?: Date;
}

export function ConnectionStatus({ isConnected, lastMessageTime }: ConnectionStatusProps) {
  const [timeSinceLastMessage, setTimeSinceLastMessage] = useState<string>('');

  useEffect(() => {
    const updateTimeSinceLastMessage = () => {
      if (lastMessageTime) {
        const now = new Date();
        const diff = now.getTime() - lastMessageTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        if (minutes > 0) {
          setTimeSinceLastMessage(`${minutes}м ${seconds}с назад`);
        } else {
          setTimeSinceLastMessage(`${seconds}с назад`);
        }
      }
    };

    updateTimeSinceLastMessage();
    const interval = setInterval(updateTimeSinceLastMessage, 1000);

    return () => clearInterval(interval);
  }, [lastMessageTime]);

  return (
    <div className="connection-status">
      <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="status-dot"></div>
        <span className="status-text">
          {isConnected ? 'Подключено' : 'Отключено'}
        </span>
      </div>
      {lastMessageTime && (
        <div className="last-message-time">
          Последнее сообщение: {timeSinceLastMessage}
        </div>
      )}
    </div>
  );
}
