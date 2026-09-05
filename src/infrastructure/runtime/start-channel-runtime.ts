export interface StartableChannelRuntime<Config> {
  start(config: Config): Promise<void>;
}

export interface ChannelRuntimeLogger {
  error(error: unknown, message: string): void;
}

export async function startChannelRuntime<Config>(options: {
  channel: string;
  config: Config | undefined;
  logger: ChannelRuntimeLogger;
  runtime: StartableChannelRuntime<Config>;
}): Promise<void> {
  if (!options.config) {
    return;
  }

  try {
    await options.runtime.start(options.config);
  } catch (error: unknown) {
    options.logger.error(
      error,
      `${options.channel} connection could not be started; HTTP operations remain available`,
    );
  }
}
