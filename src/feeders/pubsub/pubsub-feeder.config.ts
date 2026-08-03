/** DI-токен для инъекции конфига PubsubFeeder. */
export const PUBSUB_FEEDER_CONFIG = 'PUBSUB_FEEDER_CONFIG' as const;

export interface PubsubFeederConfig {
  enabled: boolean;
  /** Адрес RPC API ноды IPFS. Принимается http-URL или multiaddr. */
  apiUrl: string;
  /** Топик pubsub, куда публикуются обработанные данные. */
  topic: string;
  /** Интервал фоновой проверки коннекта, мс (когда нода недоступна). */
  retryMs: number;
}

/**
 * Синхронно загружает конфиг PubsubFeeder из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
 * @returns {PubsubFeederConfig} - Конфигурация pubsub-фидера.
 */
export function loadPubsubFeederConfig(env: NodeJS.ProcessEnv = process.env): PubsubFeederConfig {
  const retryMs = Number(env.FEEDER_PUBSUB_RETRY_MS);
  return {
    enabled: env.FEEDER_PUBSUB_ENABLED !== 'false',
    apiUrl: env.FEEDER_PUBSUB_API_URL ?? 'http://127.0.0.1:5001',
    topic: env.FEEDER_PUBSUB_TOPIC ?? 'mytop',
    retryMs: Number.isFinite(retryMs) && retryMs > 0 ? retryMs : 15000,
  };
}
