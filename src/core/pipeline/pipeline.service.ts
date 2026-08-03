import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SensorEvents } from '../../common/events';
import { ProcessedSensorReading } from '../../common/interfaces/processed-sensor-reading.interface';
import { RawSensorReading } from '../../common/interfaces/raw-sensor-reading.interface';
import { DeviceRegistry } from '../../devices/device-registry.service';

/**
 * Единая точка приёма данных из всех станций.
 *
 *   station → pipeline.ingest → DeviceRegistry.find →
 *     ├─ match: device.format → emit('sensor.reading.processed') → feeders
 *     └─ no match: warn, ничего не эмитим
 *
 * Никакой персистентности: ProcessedSensorReading формируется в памяти
 * (id = randomUUID, processedAt = now) и сразу уходит в шину событий.
 * format() бросает BadRequestException на невалидном входе → 400 наверх.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  /**
   * @param {DeviceRegistry} devices - Реестр Device-форматтеров для выбора по raw-сообщению.
   * @param {EventEmitter2} events - Шина событий NestJS для рассылки processed-ивента.
   */
  constructor(
    private readonly devices: DeviceRegistry,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Принимает сырое сообщение со станции, находит подходящий Device, форматирует payload
   * и эмитит событие SensorEvents.ReadingProcessed.
   *
   * @param {RawSensorReading} raw - Сырое сообщение со станции.
   * @returns {Promise<ProcessedSensorReading>} - Обработанная запись с идентификатором и метками времени.
   */
  async ingest(raw: RawSensorReading): Promise<ProcessedSensorReading> {
    const device = this.devices.find(raw);

    let formattedPayload: unknown = null;
    let deviceType: string | null = null;

    if (device) {
      deviceType = device.type;
      formattedPayload = await device.format(raw);
    } else {
      this.logger.warn(`No device matched for station=${raw.station}`);
    }

    const reading: ProcessedSensorReading = {
      id: randomUUID(),
      station: raw.station,
      device: deviceType,
      rawPayload: raw.payload,
      formattedPayload,
      receivedAt: raw.receivedAt,
      processedAt: new Date(),
    };

    if (formattedPayload !== null) {
      this.events.emit(SensorEvents.ReadingProcessed, reading);
      this.logger.debug(`Ingested ${reading.id} via device=${deviceType}`);
    }

    return reading;
  }
}
