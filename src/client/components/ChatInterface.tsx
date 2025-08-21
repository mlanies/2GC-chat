import React, { useRef, useEffect, useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { ChatMessage, Message, Channel } from '../../shared';
import { sanitizeContent, sanitizeUsername } from '../utils/security';
import { ChannelsPanel } from './ChannelsPanel';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatInterfaceProps } from '../types/chat';

export function ChatInterface({ 
  messages, 
  name, 
  socket, 
  onLogout,
  isMobile,
  channels = [],
  onChannelSwitch,
  currentChannelId: propCurrentChannelId
}: ChatInterfaceProps) {
  const [currentChannelId, setCurrentChannelId] = useState(propCurrentChannelId || 'general');
  const [isChannelsCollapsed, setIsChannelsCollapsed] = useState(false);

  // Обновляем currentChannelId когда изменяется prop
  useEffect(() => {
    if (propCurrentChannelId) {
      setCurrentChannelId(propCurrentChannelId);
    }
  }, [propCurrentChannelId]);

  // Фильтруем сообщения по текущему каналу
  const currentChannelMessages = messages.filter(msg => 
    !msg.channelId || msg.channelId === currentChannelId
  );

  const currentChannel = channels.find(c => c.id === currentChannelId);

  const handleChannelSelect = useCallback((channelId: string) => {
    setCurrentChannelId(channelId);
    
    if (onChannelSwitch) {
      onChannelSwitch(channelId);
    }
    
    socket.send(JSON.stringify({
      type: "channel_switch",
      channelId: channelId
    }));
  }, [onChannelSwitch, socket]);

  const handleCreateChannel = useCallback((name: string, description: string) => {
    const newChannel: Channel = {
      id: `channel-${Date.now()}`,
      name,
      description,
      createdAt: Date.now(),
      createdBy: name,
    };
    
    socket.send(JSON.stringify({
      type: "channel_create",
      channel: newChannel,
    }));
  }, [socket]);

  const handleDeleteChannel = useCallback((channelId: string) => {
    if (channelId === 'general') return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот канал? Все сообщения в нем будут потеряны.')) {
      socket.send(JSON.stringify({
        type: "channel_delete",
        channelId: channelId
      }));
    }
  }, [socket]);

  const handleSendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    
    const chatMessage: ChatMessage = {
      id: `${Date.now()}-${nanoid(8)}`,
      content: sanitizeContent(content),
      user: sanitizeUsername(name),
      role: "user",
      channelId: currentChannelId,
    };

    socket.send(JSON.stringify({
      type: "add",
      ...chatMessage,
    } satisfies Message));
  }, [socket, name, currentChannelId]);

  return (
    <div className="chat">
      <ChatHeader onLogout={onLogout} isMobile={isMobile} />

      <div className="chat-content">
        <ChannelsPanel
          channels={channels}
          currentChannelId={currentChannelId}
          onChannelSelect={handleChannelSelect}
          onCreateChannel={handleCreateChannel}
          onDeleteChannel={handleDeleteChannel}
          isCollapsed={isChannelsCollapsed}
          onToggleCollapse={() => setIsChannelsCollapsed(!isChannelsCollapsed)}
        />

        <div className="chat-main">
          <div className="channel-header">
            <h2>#{currentChannel?.name || 'general'}</h2>
          </div>

          {isMobile && (
            <button onClick={onLogout} className="mobile-logout-button">
              Выйти
            </button>
          )}
          
          <MessageList 
            messages={currentChannelMessages}
            currentUser={name}
            channelName={currentChannel?.name || 'general'}
          />
          
          <MessageInput 
            onSendMessage={handleSendMessage}
            channelName={currentChannel?.name || 'general'}
          />
        </div>
      </div>
    </div>
  );
}
