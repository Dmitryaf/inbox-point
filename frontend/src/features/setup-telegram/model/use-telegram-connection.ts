import { useRef, useState } from 'react';
import {
  connectTelegram,
  discoverTelegramChats,
} from '@frontend-common/entities/setup/api/setup-api';
import type { TelegramOperatorChat } from '@frontend-common/entities/setup/model/types';
import { useSetupCommand } from '@frontend/features/channel-setup/model/use-setup-command';

export function useTelegramConnection(onConnected: () => void) {
  const [botToken, setBotToken] = useState('');
  const tokenRevision = useRef(0);
  const [chats, setChats] = useState<TelegramOperatorChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [message, setMessage] = useState(
    'Выполните шаги ниже и найдите группу администраторов.',
  );
  const command = useSetupCommand();
  function changeToken(value: string) {
    tokenRevision.current++;
    setBotToken(value);
    setChats([]);
    setSelectedChatId(null);
  }
  function discover() {
    const revision = tokenRevision.current;
    void command.run(
      'discover',
      () => discoverTelegramChats(botToken.trim()),
      (result) => {
        if (revision !== tokenRevision.current) {
          return;
        }
        setChats(result.chats);
        setSelectedChatId(null);
        setMessage(
          result.chats.length
            ? 'Выберите группу администраторов.'
            : 'Группа не найдена. Проверьте, что бот добавлен администратором, темы включены и после добавления бота в группе отправлено сообщение.',
        );
      },
    );
  }
  function connect() {
    if (selectedChatId === null) {
      return;
    }
    void command.run(
      'connect',
      () => connectTelegram(botToken.trim(), selectedChatId),
      () => {
        setBotToken('');
        setChats([]);
        onConnected();
      },
    );
  }
  return {
    botToken,
    changeToken,
    chats,
    selectedChatId,
    setSelectedChatId,
    message,
    ...command,
    discover,
    connect,
  };
}
