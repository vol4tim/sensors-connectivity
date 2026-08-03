import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IpfsUploadedPayload, StorageEvents } from '../../../common/events';
import { DatalogRecordService } from './datalog-record.service';
import { DatalogRecordEntity } from './entities/datalog-record.entity';
import { RobonomicsChainService } from './robonomics-chain.service';
import { ROBONOMICS_DATALOG_CONFIG, RobonomicsDatalogConfig } from './robonomics-datalog.config';

/**
 * Оркестратор отправки IPFS-хешей в Robonomics datalog.
 *
 *   StorageEvents.IpfsUploaded → enqueue (NEW) → submitOne (сразу)
 *
 * Параллельно — фоновый таймер раз в `retryIntervalMs` сериально
 * драинит NEW записи (включая те, по которым прямой submit не прошёл,
 * или те, что остались с прошлого запуска приложения).
 *
 * Сериально — чтобы не ловить конфликты nonce одного аккаунта.
 */
@Injectable()
export class RobonomicsDatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RobonomicsDatalogService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  /**
   * @param {RobonomicsDatalogConfig} config - Конфиг Robonomics datalog.
   * @param {DatalogRecordService} records - Сервис очереди CID на отправку.
   * @param {RobonomicsChainService} chain - Тонкий клиент Robonomics-парачейна.
   */
  constructor(
    @Inject(ROBONOMICS_DATALOG_CONFIG) private readonly config: RobonomicsDatalogConfig,
    private readonly records: DatalogRecordService,
    private readonly chain: RobonomicsChainService,
  ) {}

  /**
   * Запускает фоновый ретрай-таймер и драйнит очередь NEW записей.
   *
   * @returns {void}
   */
  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processQueue();
    }, this.config.retryIntervalMs);
    this.timer.unref();

    this.logger.log(
      `Robonomics datalog active — retry queue every ${this.config.retryIntervalMs}ms`,
    );

    // Драйним NEW из прошлого запуска, не блокируя bootstrap.
    void this.processQueue();
  }

  /**
   * Останавливает фоновый таймер при завершении модуля.
   *
   * @returns {void}
   */
  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Обработчик события StorageEvents.IpfsUploaded. Ставит CID в очередь и
   * сразу пытается отправить его, если статус NEW.
   *
   * @param {IpfsUploadedPayload} payload - Payload с CID и списком аплоадеров.
   * @returns {Promise<void>}
   */
  @OnEvent(StorageEvents.IpfsUploaded)
  async onIpfsUploaded(payload: IpfsUploadedPayload): Promise<void> {
    let record: DatalogRecordEntity;
    try {
      record = await this.records.enqueue(payload.cid);
    } catch (e) {
      this.logger.error(
        `Failed to enqueue CID ${payload.cid}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }
    if (record.status === 'NEW') {
      await this.submitOne(record);
    }
  }

  /**
   * Обрабатывает пачку NEW записей из очереди серийно.
   *
   * @returns {Promise<void>}
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const batch = await this.records.findNew(this.config.batchSize);
      if (batch.length === 0) return;
      this.logger.debug(`Retry queue: processing ${batch.length} NEW record(s)`);
      for (const record of batch) {
        await this.submitOne(record);
      }
    } catch (e) {
      this.logger.error(`Retry queue errored: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Отправляет одну запись в Robonomics datalog и обновляет её статус.
   *
   * @param {DatalogRecordEntity} record - Запись очереди с CID.
   * @returns {Promise<void>}
   */
  private async submitOne(record: DatalogRecordEntity): Promise<void> {
    try {
      const txHash = await this.chain.submit(record.cid);
      await this.records.markDone(record.id);
      this.logger.log(`Datalog [${record.cid}] finalized in tx ${txHash}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.records.markFailure(record.id, msg).catch(() => {
        /* best effort */
      });
      this.logger.warn(
        `Datalog [${record.cid}] submit failed (attempt ${record.attempts + 1}): ${msg}`,
      );
    }
  }
}
