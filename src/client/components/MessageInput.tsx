import React, { useRef } from 'react';
import { MessageInputProps } from '../types/chat';

export function MessageInput({ onSendMessage, channelName }: MessageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputRef.current?.value;
    
    if (content?.trim()) {
      onSendMessage(content);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <form className="row" onSubmit={handleSubmit}>
      <div className="input-group">
        <input
          ref={inputRef}
          name="content"
          type="text"
          placeholder={`Сообщение в #${channelName}...`}
          autoComplete="off"
          maxLength={500}
        />
        <button type="submit" className="send-message">
          Отправить
        </button>
      </div>
    </form>
  );
}
