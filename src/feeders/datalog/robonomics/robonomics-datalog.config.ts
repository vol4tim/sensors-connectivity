/** DI-токен для конфига Robonomics datalog. */
export const ROBONOMICS_DATALOG_CONFIG = 'ROBONOMICS_DATALOG_CONFIG' as const;

/** Поддерживаемые типы ключевой пары (совпадает с KeypairType из @polkadot/util-crypto). */
const KEYPAIR_TYPES = ['ed25519', 'sr25519', 'ecdsa', 'ethereum'] as const;
export type RobonomicsKeypairType = (typeof KEYPAIR_TYPES)[number];

export interface RobonomicsDatalogConfig {
  enabled: boolean;
  /** WebSocket-эндпоинт RPC парачейна. */
  wsEndpoint: string;
  /** SURI/мнемоника аккаунта-подписанта. */
  mnemonic: string;
  /** Тип ключевой пары подписанта. */
  keypairType: RobonomicsKeypairType;
  /** Префикс SS58 для адресов. */
  ss58Format: number;
  /**
   * Адрес владельца RWS-подписки. Если задан и подписка активна — экстринсики
   * отправляются через rws.call. Пусто = прямая отправка.
   */
  rwsSubscriptionOwner: string;
  /** Период фонового ретрая NEW записей, мс. */
  retryIntervalMs: number;
  /** Сколько NEW записей берётся за один retry-проход. */
  batchSize: number;
  /** Таймаут ожидания finalize'а одного экстринсика, мс. */
  submitTimeoutMs: number;
}

/**
 * Парсит строку в положительное целое с заданным fallback.
 *
 * @param {string | undefined} raw - Строковое значение из env.
 * @param {number} fallback - Значение по умолчанию.
 * @returns {number} - Положительное целое или fallback.
 */
function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Парсит строку в неотрицательное целое с заданным fallback.
 *
 * @param {string | undefined} raw - Строковое значение из env.
 * @param {number} fallback - Значение по умолчанию.
 * @returns {number} - Неотрицательное целое или fallback.
 */
function nonNegativeInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/**
 * Валидирует тип ключевой пары Polkadot.
 *
 * @param {string | undefined} raw - Строковое значение из env.
 * @returns {RobonomicsKeypairType} - Валидный тип или 'sr25519' по умолчанию.
 */
function keypairType(raw: string | undefined): RobonomicsKeypairType {
  return (KEYPAIR_TYPES as readonly string[]).includes(raw ?? '')
    ? (raw as RobonomicsKeypairType)
    : 'sr25519';
}

/**
 * Синхронно загружает конфиг Robonomics datalog из переменных окружения.
 *
 * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
 * @returns {RobonomicsDatalogConfig} - Загруженная конфигурация подключения к парачейну.
 */
export function loadRobonomicsDatalogConfig(
  env: NodeJS.ProcessEnv = process.env,
): RobonomicsDatalogConfig {
  // По умолчанию выключен — нужны mnemonic и работающий WS-эндпоинт.
  return {
    enabled: env.ROBONOMICS_DATALOG_ENABLED === 'true',
    wsEndpoint: env.ROBONOMICS_WS_ENDPOINT ?? 'wss://kusama.rpc.robonomics.network/',
    mnemonic: env.ROBONOMICS_MNEMONIC ?? '',
    keypairType: keypairType(env.ROBONOMICS_KEYPAIR_TYPE),
    ss58Format: nonNegativeInt(env.ROBONOMICS_SS58_FORMAT, 32),
    rwsSubscriptionOwner: env.ROBONOMICS_RWS_SUBSCRIPTION_OWNER ?? '',
    retryIntervalMs: positiveInt(env.ROBONOMICS_RETRY_MS, 60000),
    batchSize: positiveInt(env.ROBONOMICS_BATCH_SIZE, 20),
    submitTimeoutMs: positiveInt(env.ROBONOMICS_SUBMIT_TIMEOUT_MS, 300000),
  };
}
