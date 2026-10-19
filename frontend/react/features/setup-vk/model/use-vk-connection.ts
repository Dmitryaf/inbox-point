import { useState } from 'react';
import { connectVk } from '@frontend-common/entities/setup/api/setup-api';
import { useSetupCommand } from '@frontend/features/channel-setup/model/use-setup-command';

export function useVkConnection(onConnected: () => void) {
  const [accessToken, setAccessToken] = useState('');
  const [community, setCommunity] = useState('');
  const command = useSetupCommand();
  function connect() {
    void command.run(
      'connect',
      () => connectVk(accessToken.trim(), community.trim()),
      () => {
        setAccessToken('');
        onConnected();
      },
    );
  }
  return {
    accessToken,
    setAccessToken,
    community,
    setCommunity,
    ...command,
    connect,
  };
}
