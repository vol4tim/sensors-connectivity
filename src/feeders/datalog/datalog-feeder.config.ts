/** DI-токен для инъекции конфига DatalogFeeder. */
export const DATALOG_FEEDER_CONFIG = 'DATALOG_FEEDER_CONFIG' as const;

export interface DatalogFeederConfig {
  enabled: boolean;
  /** Окно накопления сообщений в памяти перед flush'ем, мс. */
  flushIntervalMs: number;
}

/**
 * Синхронно загружает конфиг DatalogFeeder из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
 * @returns {DatalogFeederConfig} - Конфигурация фидера с flush-интервалом.
 */
export function loadDatalogFeederConfig(env: NodeJS.ProcessEnv = process.env): DatalogFeederConfig {
  const flush = Number(env.FEEDER_DATALOG_FLUSH_MS);
  return {
    enabled: env.FEEDER_DATALOG_ENABLED !== 'false',
    flushIntervalMs: Number.isFinite(flush) && flush > 0 ? flush : 60000,
  };
}
