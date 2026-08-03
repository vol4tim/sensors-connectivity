/** DI-токен для инъекции конфига HTTP-станции в её контроллеры/сервисы. */
export const HTTP_STATION_CONFIG = 'HTTP_STATION_CONFIG' as const;

export interface HttpStationConfig {
  enabled: boolean;
}

/**
 * Синхронный загрузчик конфига из process.env.
 * Используется в StationsModule.registerFromEnv() на этапе композиции модулей.
 * Дефолты задаются прямо здесь — фоллбэками `??` / `!== 'false'`.
 */
/**
 * Синхронно загружает конфиг HTTP-станции из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
 * @returns {HttpStationConfig} - Загруженная конфигурация станции.
 */
export function loadHttpStationConfig(env: NodeJS.ProcessEnv = process.env): HttpStationConfig {
  return {
    enabled: env.STATION_HTTP_ENABLED !== 'false',
  };
}
