/** DI-токен для конфига PinataUploader. */
export const PINATA_UPLOADER_CONFIG = 'PINATA_UPLOADER_CONFIG' as const;

export interface PinataUploaderConfig {
  enabled: boolean;
  /** JWT с правами `pinFileToIPFS` (Pinata → API Keys). */
  jwt: string;
  /** База API Pinata. */
  apiUrl: string;
}

/**
 * Синхронно загружает конфиг PinataUploader из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
 * @returns {PinataUploaderConfig} - Конфигурация Pinata-аплоадера.
 */
export function loadPinataUploaderConfig(
  env: NodeJS.ProcessEnv = process.env,
): PinataUploaderConfig {
  // По умолчанию выключен — для работы нужен JWT, явное opt-in через env.
  return {
    enabled: env.IPFS_PINATA_ENABLED === 'true',
    jwt: env.IPFS_PINATA_JWT ?? '',
    apiUrl: env.IPFS_PINATA_API_URL ?? 'https://api.pinata.cloud',
  };
}
