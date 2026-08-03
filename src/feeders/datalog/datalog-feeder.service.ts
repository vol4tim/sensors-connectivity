import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IpfsUploadedPayload, SensorEvents, StorageEvents } from '../../common/events';
import { Feeder } from '../../common/interfaces/feeder.interface';
import { ProcessedSensorReading } from '../../common/interfaces/processed-sensor-reading.interface';
import { IpfsUploaderRegistry } from '../../ipfs-uploaders/ipfs-uploader-registry.service';
import { DATALOG_FEEDER_CONFIG, DatalogFeederConfig } from './datalog-feeder.config';

/**
 * Копит обработанные сообщения в памяти в течение `flushIntervalMs`, затем
 * агрегирует их в payload по схеме Altruist:
 *
 *   payload[robonomics_address] = {
 *     ...последний объект для этого адреса (model, geo, donated_by, signature, ...),
 *     measurements: [data.measurement, ...]  // отсортированы по timestamp asc
 *   }
 *
 * Готовый payload сохраняется во временный файл, который параллельно
 * заливается во все включённые IPFS-аплоадеры; результаты (CID/ошибки)
 * пишутся в лог. Временный файл удаляется после.
 */
@Injectable()
export class DatalogFeederService implements Feeder, OnModuleInit, OnModuleDestroy {
  readonly channel = 'datalog';
  private readonly logger = new Logger(DatalogFeederService.name);
  private buffer: unknown[] = [];
  private timer?: NodeJS.Timeout;
  private flushing = false;

  /**
   * @param {DatalogFeederConfig} config - Конфиг фидера (flushIntervalMs).
   * @param {IpfsUploaderRegistry} uploaders - Реестр включённых IPFS-аплоадеров.
   * @param {EventEmitter2} events - Шина событий для публикации StorageEvents.IpfsUploaded.
   */
  constructor(
    @Inject(DATALOG_FEEDER_CONFIG) private readonly config: DatalogFeederConfig,
    private readonly uploaders: IpfsUploaderRegistry,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Запускает таймер периодического flush'а буфера.
   *
   * @returns {void}
   */
  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
    this.timer.unref();
    this.logger.log(
      `Datalog feeder buffering — flush every ${this.config.flushIntervalMs}ms ` +
        `(${this.uploaders.count} IPFS uploader(s))`,
    );
  }

  /**
   * Останавливает таймер и форсирует финальный flush при завершении модуля.
   *
   * @returns {Promise<void>}
   */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.flush();
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
   * Добавляет formattedPayload в буфер, если он не null.
   *
   * @param {ProcessedSensorReading} reading - Обработанная запись из pipeline.
   * @returns {Promise<void>}
   */
  publish(reading: ProcessedSensorReading): Promise<void> {
    if (reading.formattedPayload != null) {
      this.buffer.push(reading.formattedPayload);
    }
    return Promise.resolve();
  }

  /**
   * Сливает накопленный буфер в агрегированный payload, загружает его в IPFS
   * и эмитит событие об успешной загрузке.
   *
   * @returns {Promise<void>}
   */
  private async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.buffer.length === 0) return;
    this.flushing = true;

    try {
      const batch = this.buffer;
      this.buffer = [];

      const payload = this.buildAggregatedPayload(batch);
      const addressCount = Object.keys(payload).length;
      if (addressCount === 0) {
        this.logger.debug(
          `Datalog flush — ${batch.length} message(s) had no Altruist-shaped payloads, skipping`,
        );
        return;
      }

      if (this.uploaders.count === 0) {
        this.logger.warn(
          `Datalog flush — no IPFS uploaders enabled, dropping batch ` +
            `(${batch.length} messages → ${addressCount} address(es))`,
        );
        return;
      }

      const filePath = await this.writeTempFile(payload);
      try {
        const { cid, uploaders } = await this.uploaders.uploadAll(filePath);
        if (cid) {
          this.logger.log(
            `Uploaded ${addressCount} address(es) — CID ${cid} (via ${uploaders.join(', ')})`,
          );
          const event: IpfsUploadedPayload = { cid, uploaders };
          this.events.emit(StorageEvents.IpfsUploaded, event);
        } else {
          this.logger.error(`All IPFS uploaders failed for batch of ${addressCount} address(es)`);
        }
      } finally {
        await fs.unlink(filePath).catch(() => {
          /* best-effort cleanup */
        });
      }
    } catch (e) {
      this.logger.error(`Datalog flush errored: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Группирует batch по top-level ключу (robonomics_address):
   *   - все поля inner-объекта берутся из последнего элемента (last-wins);
   *   - все `measurement` собираются в массив `measurements` и сортируются по timestamp asc;
   *   - элементы без Altruist-формы (нет `measurement`) игнорируются.
   *
   * @param {unknown[]} batch - Массив formattedPayload из буфера.
   * @returns {Record<string, Record<string, unknown>>} - Агрегированный payload по адресам.
   */
  private buildAggregatedPayload(batch: unknown[]): Record<string, Record<string, unknown>> {
    const groups = new Map<string, { last: Record<string, unknown>; measurements: unknown[] }>();

    for (const entry of batch) {
      if (!entry || typeof entry !== 'object') continue;
      for (const [address, data] of Object.entries(entry as Record<string, unknown>)) {
        if (!data || typeof data !== 'object') continue;
        const obj = data as Record<string, unknown>;
        const measurement = obj.measurement;
        if (!measurement || typeof measurement !== 'object') continue;

        let group = groups.get(address);
        if (!group) {
          group = { last: obj, measurements: [] };
          groups.set(address, group);
        } else {
          group.last = obj;
        }
        group.measurements.push(measurement);
      }
    }

    const payload: Record<string, Record<string, unknown>> = {};
    for (const [address, group] of groups) {
      const { measurement: _drop, ...rest } = group.last;
      void _drop;
      const measurements = [...group.measurements].sort((a, b) => {
        const ta = Number((a as { timestamp?: unknown }).timestamp ?? 0);
        const tb = Number((b as { timestamp?: unknown }).timestamp ?? 0);
        return ta - tb;
      });
      payload[address] = { ...rest, measurements };
    }
    return payload;
  }

  /**
   * Сериализирует payload во временный JSON-файл.
   *
   * @param {unknown} payload - Агрегированный payload для загрузки в IPFS.
   * @returns {Promise<string>} - Абсолютный путь к временному файлу.
   */
  private async writeTempFile(payload: unknown): Promise<string> {
    const filePath = join(tmpdir(), `sensors-connectivity-${randomUUID()}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload));
    return filePath;
  }
}
