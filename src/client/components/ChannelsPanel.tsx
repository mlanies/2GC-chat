import React, { useState } from 'react';
import { Channel } from '../../shared';

interface ChannelsPanelProps {
  channels: Channel[];
  currentChannelId: string;
  onChannelSelect: (channelId: string) => void;
  onCreateChannel: (name: string, description: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ChannelsPanel({
  channels,
  currentChannelId,
  onChannelSelect,
  onCreateChannel,
  isCollapsed,
  onToggleCollapse
}: ChannelsPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (newChannelName.trim()) {
      onCreateChannel(newChannelName.trim(), newChannelDescription.trim());
      setNewChannelName('');
      setNewChannelDescription('');
      setShowCreateForm(false);
    }
  };

  return (
    <div className={`channels-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="channels-header">
        <h3>Каналы</h3>
        <div className="channels-actions">
          <button
            className="create-channel-btn"
            onClick={() => setShowCreateForm(!showCreateForm)}
            title="Создать канал"
          >
            ➕
          </button>
          <button
            className="collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? "Развернуть" : "Свернуть"}
          >
            {isCollapsed ? '▶' : '◀'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {showCreateForm && (
            <form className="create-channel-form" onSubmit={handleCreateChannel}>
              <input
                type="text"
                placeholder="Название канала"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Описание (необязательно)"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
              />
              <div className="form-actions">
                <button type="submit" className="submit-btn">Создать</button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCreateForm(false)}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          <div className="channels-list">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`channel-item ${currentChannelId === channel.id ? 'active' : ''}`}
                onClick={() => onChannelSelect(channel.id)}
              >
                <div className="channel-name">#{channel.name}</div>
                {channel.description && (
                  <div className="channel-description">{channel.description}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

