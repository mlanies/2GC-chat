import type { Message, AuthMessage, BotProtectionMessage, Channel, ChatMessage } from "../../shared";

export interface MessageHandlerContext {
  connection: any;
  authenticatedUsers: Set<string>;
  verifiedUsers: Set<string>;
  userChannels: Map<string, string>;
  messages: ChatMessage[];
  channels: Channel[];
  broadcastMessage: (message: Message, exclude?: string[], targetChannelId?: string) => void;
  sendToConnection: (message: any) => void;
  saveMessage: (message: any) => Promise<void>;
  validateSessionToken: (token: string) => boolean;
  authenticateUser: (connection: any, password: string) => Promise<void>;
  handleTurnstileVerification: (connection: any, token: string) => void;
  handleCustomChallenge: (connection: any, answer: string) => void;
  generateCustomChallenge: (connectionId: string) => any;
  env: any;
  ctx: any;
}

export async function handleAuthMessage(
  parsed: AuthMessage,
  context: MessageHandlerContext
) {
  const { connection, authenticatedUsers, sendToConnection, validateSessionToken, authenticateUser } = context;

  if (parsed.sessionToken) {
    // Проверяем токен сессии
    if (validateSessionToken(parsed.sessionToken)) {
      // Токен валиден, аутентифицируем пользователя
      authenticatedUsers.add(connection.id);
      sendToConnection({
        type: "auth_success",
        messages: context.messages.filter(msg => !msg.channelId || msg.channelId === 'general'),
        sessionToken: parsed.sessionToken,
        channels: context.channels
      });
    } else {
      // Токен невалиден
      sendToConnection({
        type: "auth_failed",
        error: "Недействительный токен сессии"
      });
    }
  } else if (parsed.password) {
    await authenticateUser(connection, parsed.password);
  } else {
    sendToConnection({
      type: "auth_failed",
      error: "Не указан пароль или токен сессии"
    });
  }
}

export async function handleChatMessage(
  parsed: any,
  context: MessageHandlerContext
) {
  const { connection, broadcastMessage, saveMessage } = context;

  try {
    console.log(`[${new Date().toISOString()}] Starting to process chat message:`, parsed.type, parsed.id);
    
    await saveMessage(parsed);
    console.log(`[${new Date().toISOString()}] Message saved successfully`);
    
    // Отправляем push-уведомление всем подключенным пользователям
    console.log(`[${new Date().toISOString()}] Sending push notification`);
    broadcastMessage({
      type: "push_notification",
      title: "Новое сообщение",
      body: `${parsed.user}: ${parsed.content}`,
      icon: "/favicon.ico",
    }, [connection.id]);
    
    // Отправляем сообщение всем пользователям в том же канале (включая отправителя)
    const channelId = parsed.channelId || 'general';
    console.log(`[${new Date().toISOString()}] Broadcasting message to channel:`, channelId);
    broadcastMessage(parsed, [], channelId); // Убираем исключение отправителя
    console.log(`[${new Date().toISOString()}] Message broadcasted successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing message:`, error);
  }
}

export async function handleChannelCreate(
  parsed: Message,
  context: MessageHandlerContext
) {
  const { connection, channels, broadcastMessage, sendToConnection, ctx } = context;

  try {
    const newChannel = (parsed as any).channel;
    
    // Проверяем, что канал с таким именем не существует
    const existingChannel = channels.find(ch => ch.name === newChannel.name);
    if (existingChannel) {
      sendToConnection({
        type: "channel_create_failed",
        error: "Канал с таким именем уже существует"
      });
      return;
    }
    
    // Добавляем канал в память
    channels.push(newChannel);
    
    // Сохраняем канал в базу данных
    ctx.storage.sql.exec(
      `INSERT INTO channels (id, name, description, created_at, created_by) VALUES ('${newChannel.id}', '${newChannel.name}', '${newChannel.description || ''}', ${newChannel.createdAt}, '${newChannel.createdBy}')`
    );
    
    console.log(`[${new Date().toISOString()}] Channel created successfully:`, newChannel.name);
    
    // Отправляем подтверждение создателю канала
    sendToConnection({
      type: "channel_create_success",
      channel: newChannel
    });
    
    // Уведомляем всех пользователей о новом канале
    broadcastMessage({
      type: "channel_list",
      channels: channels
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error creating channel:`, error);
    sendToConnection({
      type: "channel_create_failed",
      error: "Ошибка при создании канала"
    });
  }
}

export async function handleChannelSwitch(
  parsed: Message,
  context: MessageHandlerContext
) {
  const { connection, userChannels, messages, sendToConnection } = context;

  // Обновляем текущий канал пользователя
  userChannels.set(connection.id, (parsed as any).channelId);
  
  // Отправляем сообщения только для этого канала
  const channelMessages = messages.filter(msg => 
    !msg.channelId || msg.channelId === (parsed as any).channelId
  );
  
  sendToConnection({
    type: "channel_switch",
    channelId: (parsed as any).channelId,
    messages: channelMessages
  });
}

export async function handleChannelDelete(
  parsed: Message,
  context: MessageHandlerContext
) {
  const { connection, channels, broadcastMessage, sendToConnection, ctx } = context;

  try {
    const channelId = (parsed as any).channelId;
    
    // Проверяем, что канал не является общим
    if (channelId === 'general') {
      sendToConnection({
        type: "channel_delete_failed",
        error: "Нельзя удалить общий канал"
      });
      return;
    }
    
    // Находим канал для удаления
    const channelIndex = channels.findIndex(ch => ch.id === channelId);
    if (channelIndex === -1) {
      sendToConnection({
        type: "channel_delete_failed",
        error: "Канал не найден"
      });
      return;
    }
    
    const channelToDelete = channels[channelIndex];
    
    // Удаляем канал из базы данных
    ctx.storage.sql.exec(
      `DELETE FROM channels WHERE id = '${channelId}'`
    );
    
    // Удаляем все сообщения этого канала
    ctx.storage.sql.exec(
      `DELETE FROM messages WHERE channel_id = '${channelId}'`
    );
    
    // Удаляем канал из памяти
    channels.splice(channelIndex, 1);
    
    console.log(`[${new Date().toISOString()}] Channel deleted successfully:`, channelToDelete.name);
    
    // Отправляем подтверждение удаления
    sendToConnection({
      type: "channel_delete_success",
      channelId: channelId,
      channelName: channelToDelete.name
    });
    
    // Уведомляем всех пользователей об удалении канала
    broadcastMessage({
      type: "channel_list",
      channels: channels
    });
    
    // Уведомляем о переключении на общий канал если пользователь был в удаленном канале
    broadcastMessage({
      type: "channel_switch_required",
      channelId: 'general',
      reason: `Канал "${channelToDelete.name}" был удален`
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error deleting channel:`, error);
    sendToConnection({
      type: "channel_delete_failed",
      error: "Ошибка при удалении канала"
    });
  }
}
