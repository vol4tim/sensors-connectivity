import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { KuboRPCClient } from 'kubo-rpc-client';
import { SensorEvents } from '../../common/events';
import { Feeder } from '../../common/interfaces/feeder.interface';
import { ProcessedSensorReading } from '../../common/interfaces/processed-sensor-reading.interface';
import { PUBSUB_FEEDER_CONFIG, PubsubFeederConfig } from './pubsub-feeder.config';

// https://github.com/ipfs/js-kubo-rpc-client/issues/338
// kubo-rpc-client — ESM-only, проект компилится в CommonJS. Прямой import()
// tsc понизил бы до require() → ERR_REQUIRE_ESM. Function-обёртка скрывает
// динамический импорт от компилятора (общепринятый обход).
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const esmImport = new Function('s', 'return import(s)') as <T>(s: string) => Promise<T>;

/** Таймаут проверки коннекта — чтобы недоступная нода не вешала старт/поллер. */
const CONNECT_CHECK_TIMEOUT_MS = 3000;

/**
 * Публикует обработанные данные в IPFS pubsub.
 *
 * Отказоустойчивость:
 *  - недоступность ноды на старте НЕ блокирует приложение (всё в try/catch);
 *  - пока нода недоступна — фоновый поллер раз в `retryMs` проверяет коннект;
 *  - как только коннект появился — фидер автоматически возобновляет публикацию;
 *  - ошибки/недоступность изолированы в этом сервисе и не влияют на другие фидеры.
 */
@Injectable()
export class PubsubFeederService implements Feeder, OnModuleInit, OnModuleDestroy {
  readonly channel = 'pubsub';
  private readonly logger = new Logger(PubsubFeederService.name);
  private client?: KuboRPCClient;
  private connected = false;
  private poller?: NodeJS.Timeout;

  /**
   * @param {PubsubFeederConfig} config - Конфиг pubsub-фидера.
   */
  constructor(@Inject(PUBSUB_FEEDER_CONFIG) private readonly config: PubsubFeederConfig) {}

  /**
   * Инициализирует Kubo RPC-клиент и проверяет доступность ноды.
   *
   * @returns {Promise<void>}
   */
  async onModuleInit(): Promise<void> {
    try {
      const { create } = await esmImport<typeof import('kubo-rpc-client')>('kubo-rpc-client');
      this.client = create(this.config.apiUrl);
    } catch (e) {
      this.logger.error(`PubsubFeeder init failed (${this.msg(e)}); feeder inactive until restart`);
      return;
    }

    if (await this.checkConnection()) {
      this.connected = true;
      this.logger.log(
        `Connected to IPFS at ${this.config.apiUrl} — publishing to "${this.config.topic}"`,
      );
    } else {
      this.logger.warn(
        `IPFS node unreachable at ${this.config.apiUrl} — pausing publish, ` +
          `retrying every ${this.config.retryMs}ms`,
      );
      this.scheduleNextCheck();
    }
  }

  /**
   * Останавливает фоновый поллер при завершении модуля.
   *
   * @returns {void}
   */
  onModuleDestroy(): void {
    this.clearPoller();
  }

  /**
   * Обработчик события SensorEvents.ReadingProcessed.
   *
   * @param {ProcessedSensorReading} reading - Обработанная запись из pipeline.
   * @returns {Promise<void>}
   */
  @OnEvent(SensorEvents.ReadingProcessed)
  async onReadingProcessed(reading: ProcessedSensorReading): Promise<void> {
    await this.publish(reading);
  }

  /**
   * Публикует formattedPayload в pubsub топик, если нода доступна.
   *
   * @param {ProcessedSensorReading} reading - Обработанная запись из pipeline.
   * @returns {Promise<void>}
   */
  async publish(reading: ProcessedSensorReading): Promise<void> {
    if (reading.formattedPayload == null) return;
    if (!this.client || !this.connected) {
      this.logger.debug(`IPFS not connected — skipping reading ${reading.id}`);
      return;
    }

    try {
      const data = new TextEncoder().encode(JSON.stringify(reading.formattedPayload));
      await this.client.pubsub.publish(this.config.topic, data);
      this.logger.debug(`Published reading ${reading.id} to "${this.config.topic}"`);
    } catch (e) {
      this.logger.error(`Failed to publish reading ${reading.id}: ${this.msg(e)}`);
      this.markDisconnected('publish error');
    }
  }

  /**
   * Проверяет, отвечает ли Kubo RPC нода.
   *
   * @returns {Promise<boolean>} - true, если нода доступна.
   */
  private async checkConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.withTimeout(this.client.id(), CONNECT_CHECK_TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Планирует следующую проверку коннекта через retryMs.
   *
   * @returns {void}
   */
  private scheduleNextCheck(): void {
    if (this.poller) return;
    this.poller = setTimeout(() => {
      this.poller = undefined;
      void this.pollOnce();
    }, this.config.retryMs);
    this.poller.unref();
  }

  /**
   * Одиночная попытка восстановить соединение с IPFS.
   *
   * @returns {Promise<void>}
   */
  private async pollOnce(): Promise<void> {
    if (await this.checkConnection()) {
      this.connected = true;
      this.logger.log(
        `IPFS reconnected at ${this.config.apiUrl} — resuming publish to "${this.config.topic}"`,
      );
      this.clearPoller();
    } else {
      this.scheduleNextCheck();
    }
  }

  /**
   * Переводит фидер в состояние disconnected и планирует ретрай.
   *
   * @param {string} reason - Причина потери соединения.
   * @returns {void}
   */
  private markDisconnected(reason: string): void {
    if (this.connected) {
      this.logger.warn(
        `IPFS connection lost (${reason}) — pausing publish, ` +
          `retrying every ${this.config.retryMs}ms`,
      );
    }
    this.connected = false;
    this.scheduleNextCheck();
  }

  /**
   * Очищает фоновый таймер поллера.
   *
   * @returns {void}
   */
  private clearPoller(): void {
    if (this.poller) {
      clearTimeout(this.poller);
      this.poller = undefined;
    }
  }

  /**
   * Оборачивает Promise в race с таймаутом.
   *
   * @param {Promise<T>} p - Исходный Promise.
   * @param {number} ms - Таймаут в миллисекундах.
   * @returns {Promise<T>} - Результат Promise или reject по таймауту.
   * @template T - Тип результата Promise.
   */
  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        t.unref();
      }),
    ]);
  }

  /**
   * Возвращает человекочитаемое сообщение об ошибке.
   *
   * @param {unknown} e - Произвольная ошибка.
   * @returns {string} - Сообщение ошибки или строковое представление.
   */
  private msg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
