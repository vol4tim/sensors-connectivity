/** DI-токен конфигурации Altruist-устройства. */
export const ALTRUIST_DEVICE_CONFIG = 'ALTRUIST_DEVICE_CONFIG' as const;

/** Конфигурация Altruist-устройства. */
export interface AltruistDeviceConfig {
  /**
   * Список идентификаторов legacy-сенсоров (robonomics_address),
   * у которых ключ `co` в sensordatavalues означает CO2.
   */
  legacySensorIds: string[];
}

/**
 * Загружает конфигурацию Altruist-устройства из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Переменные окружения (по умолчанию process.env).
 * @returns {AltruistDeviceConfig} - Загруженная конфигурация.
 */
export function loadAltruistDeviceConfig(env = process.env): AltruistDeviceConfig {
  const raw = env.ALTRUIST_LEGACY_SENSOR_IDS ?? '';
  return {
    legacySensorIds: raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  };
}
