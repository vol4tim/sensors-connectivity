import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ApiPromise, WsProvider } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { Keyring } from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { DispatchError } from '@polkadot/types/interfaces';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { ROBONOMICS_DATALOG_CONFIG, RobonomicsDatalogConfig } from './robonomics-datalog.config';

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

/**
 * Минимальная форма Option<PalletRobonomicsRwsSubscriptionLedger>: только
 * поля, которые реально читаются. Полные типы дал бы chain-specific typegen,
 * но ради одной storage-функции его не подключаем.
 */
interface RwsLedger {
  isNone: boolean;
  value: {
    issueTime: { toNumber(): number };
    kind: {
      isLifetime: boolean;
      isDaily: boolean;
      asDaily: { days: { toNumber(): number } };
    };
  };
}

/**
 * Тонкий клиент Robonomics-парачейна: лениво поднимает WS-коннект и
 * подписывающий аккаунт, выставляет datalog.record-экстринсик и ждёт
 * finalize. Никаких ретраев тут — это делает RobonomicsDatalogService
 * на уровне очереди.
 */
@Injectable()
export class RobonomicsChainService implements OnModuleDestroy {
  private readonly logger = new Logger(RobonomicsChainService.name);
  private api?: ApiPromise;
  private account?: KeyringPair;
  private connecting?: Promise<ApiPromise>;

  /**
   * @param {RobonomicsDatalogConfig} config - Конфиг подключения и подписанта.
   */
  constructor(
    @Inject(ROBONOMICS_DATALOG_CONFIG) private readonly config: RobonomicsDatalogConfig,
  ) {}

  /**
   * Отключается от Robonomics RPC при завершении приложения.
   *
   * @returns {Promise<void>}
   */
  async onModuleDestroy(): Promise<void> {
    if (this.api) {
      try {
        await this.api.disconnect();
      } catch {
        /* ignore */
      }
      this.api = undefined;
    }
  }

  /**
   * Отправляет datalog.record(cid), резолвится на isFinalized, реджектит на dispatchError/таймауте.
   *
   * @param {string} cid - CID для записи в datalog.
   * @returns {Promise<string>} - Хэш финализированного экстринсика.
   */
  async submit(cid: string): Promise<string> {
    const api = await this.ensureConnected();
    const account = await this.ensureAccount();
    const datalogCall = api.tx.datalog.record(cid);
    const tx = await this.maybeWrapInRws(api, datalogCall);

    return this.waitFinalized(api, tx, account, cid);
  }

  /**
   * Если в конфиге задан владелец RWS-подписки и подписка активна — оборачивает
   * call в rws.call(subscriptionId, call) (комиссию платит подписка).
   * Иначе возвращает исходный экстринсик для прямой отправки.
   *
   * @param {ApiPromise} api - Подключённый Polkadot API.
   * @param {SubmittableExtrinsic<'promise'>} call - Исходный экстринсик datalog.record.
   * @returns {Promise<SubmittableExtrinsic<'promise'>>} - Возможно обёрнутый в rws экстринсик.
   */
  private async maybeWrapInRws(
    api: ApiPromise,
    call: SubmittableExtrinsic<'promise'>,
  ): Promise<SubmittableExtrinsic<'promise'>> {
    const owner = this.config.rwsSubscriptionOwner;
    if (!owner) return call;

    if (!api.tx.rws?.call) {
      this.logger.warn('rws.call not available on chain — using direct extrinsic');
      return call;
    }
    if (!(await this.isSubscriptionActive(api, owner))) {
      this.logger.warn(`RWS subscription ${owner} is not active — using direct extrinsic`);
      return call;
    }

    this.logger.debug(`Routing extrinsic through RWS subscription ${owner}`);
    return api.tx.rws.call(owner, call.method);
  }

  /**
   * Активна ли RWS-подписка владельца.
   * Читает chainstate rws.ledger(owner):
   *   - подписки нет (None)        → false;
   *   - kind=Lifetime              → true (бессрочная);
   *   - kind=Daily                 → true, пока now ≤ issueTime + days·DAYS_TO_MS.
   * Любая ошибка чтения трактуется как «не активна» → прямая отправка.
   *
   * @param {ApiPromise} api - Подключённый Polkadot API.
   * @param {string} owner - SS58-адрес владельца RWS-подписки.
   * @returns {Promise<boolean>} - true, если подписка активна.
   */
  private async isSubscriptionActive(api: ApiPromise, owner: string): Promise<boolean> {
    if (!api.query.rws?.ledger) {
      this.logger.warn('rws.ledger storage not available on chain');
      return false;
    }

    let ledger: RwsLedger;
    try {
      ledger = (await api.query.rws.ledger(owner)) as unknown as RwsLedger;
    } catch (e) {
      this.logger.warn(
        `Failed to read rws.ledger(${owner}): ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }

    if (ledger.isNone) {
      return false; // подписка никогда не покупалась
    }

    const { kind, issueTime } = ledger.value;
    if (kind.isLifetime) {
      return true;
    }
    if (kind.isDaily) {
      const validUntil = issueTime.toNumber() + kind.asDaily.days.toNumber() * DAYS_TO_MS;
      return Date.now() <= validUntil;
    }
    return false;
  }

  /**
   * Лениво устанавливает WebSocket-подключение к Robonomics.
   *
   * @returns {Promise<ApiPromise>} - Подключённый Polkadot API.
   */
  private async ensureConnected(): Promise<ApiPromise> {
    if (this.api?.isConnected) return this.api;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const provider = new WsProvider(this.config.wsEndpoint);
      const api = await ApiPromise.create({ provider, throwOnConnect: true });
      this.api = api;
      this.logger.log(`Connected to Robonomics ${this.config.wsEndpoint}`);
      return api;
    })().finally(() => {
      this.connecting = undefined;
    });

    return this.connecting;
  }

  /**
   * Лениво создаёт KeyringPair из мнемоники из конфига.
   *
   * @returns {Promise<KeyringPair>} - Пара ключей для подписи экстринсиков.
   * @throws {Error} - Если мнемоника не задана.
   */
  private async ensureAccount(): Promise<KeyringPair> {
    if (this.account) return this.account;
    if (!this.config.mnemonic) {
      throw new Error('ROBONOMICS_MNEMONIC is not configured');
    }
    await cryptoWaitReady();
    const keyring = new Keyring({
      type: this.config.keypairType,
      ss58Format: this.config.ss58Format,
    });
    this.account = keyring.addFromUri(this.config.mnemonic);
    this.logger.log(
      `Datalog signer: ${this.account.address} ` +
        `(${this.config.keypairType}, ss58=${this.config.ss58Format})`,
    );
    return this.account;
  }

  /**
   * Подписывает и отправляет экстринсик, ожидая finalize.
   *
   * @param {ApiPromise} api - Подключённый Polkadot API.
   * @param {SubmittableExtrinsic<'promise'>} tx - Готовый к отправке экстринсик.
   * @param {KeyringPair} account - Пара ключей подписанта.
   * @param {string} cid - CID, записываемый в datalog.
   * @returns {Promise<string>} - Хэш финализированного экстринсика.
   */
  private waitFinalized(
    api: ApiPromise,
    tx: SubmittableExtrinsic<'promise'>,
    account: KeyringPair,
    cid: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let unsub: (() => void) | null = null;
      const settle = (fn: () => void) => {
        clearTimeout(timeout);
        unsub?.();
        fn();
      };

      const timeout = setTimeout(() => {
        settle(() =>
          reject(new Error(`Datalog submit timeout after ${this.config.submitTimeoutMs}ms`)),
        );
      }, this.config.submitTimeoutMs);
      timeout.unref();

      tx.signAndSend(account, ({ status, dispatchError, txHash }) => {
        if (dispatchError) {
          settle(() => reject(new Error(this.formatDispatchError(api, dispatchError))));
          return;
        }
        if (status.isFinalized) {
          settle(() => resolve(txHash.toString()));
        }
      })
        .then((u) => {
          unsub = u;
        })
        .catch((e: unknown) => {
          settle(() => reject(e instanceof Error ? e : new Error(String(e))));
        });

      this.logger.debug(`Submitting datalog.record(${cid})`);
    });
  }

  /**
   * Декодирует dispatchError в читаемую строку.
   *
   * @param {ApiPromise} api - Подключённый Polkadot API.
   * @param {DispatchError} dispatchError - Ошибка из события статуса экстринсика.
   * @returns {string} - Читаемое описание ошибки.
   */
  private formatDispatchError(api: ApiPromise, dispatchError: DispatchError): string {
    if (dispatchError.isModule) {
      try {
        const decoded = api.registry.findMetaError(dispatchError.asModule);
        return `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
      } catch {
        /* fall through */
      }
    }
    return dispatchError.toString();
  }
}
