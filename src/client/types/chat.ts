import { ChatMessage, Channel } from '../../../shared';

export interface ChatInterfaceProps {
  messages: ChatMessage[];
  name: string;
  socket: any;
  onLogout: () => void;
  isMobile: boolean;
  channels?: Channel[];
  onChannelSwitch?: (channelId: string) => void;
  currentChannelId?: string;
}

export interface ChatHeaderProps {
  onLogout: () => void;
  isMobile: boolean;
}

export interface MessageListProps {
  messages: ChatMessage[];
  currentUser: string;
  channelName: string;
}

export interface MessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  isDeleting: boolean;
}

export interface MessageInputProps {
  onSendMessage: (content: string) => void;
  channelName: string;
}
