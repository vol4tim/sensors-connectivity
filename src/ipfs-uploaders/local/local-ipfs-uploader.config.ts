/** DI-токен для конфига LocalIpfsUploader. */
export const LOCAL_IPFS_UPLOADER_CONFIG = 'LOCAL_IPFS_UPLOADER_CONFIG' as const;

export interface LocalIpfsUploaderConfig {
  enabled: boolean;
  /** http-URL или multiaddr RPC API ноды Kubo. */
  apiUrl: string;
}

/**
 * Синхронно загружает конфиг LocalIpfsUploader из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
 * @returns {LocalIpfsUploaderConfig} - Конфигурация локального IPFS-аплоадера.
 */
export function loadLocalIpfsUploaderConfig(
  env: NodeJS.ProcessEnv = process.env,
): LocalIpfsUploaderConfig {
  return {
    enabled: env.IPFS_LOCAL_ENABLED !== 'false',
    apiUrl: env.IPFS_LOCAL_API_URL ?? 'http://127.0.0.1:5001',
  };
}
