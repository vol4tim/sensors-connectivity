import { ProcessedSensorReading } from './processed-sensor-reading.interface';

/**
 * Feeder — output adapter, публикует обработанные данные наружу
 * (IPFS pubsub, Robonomics parachain, ...).
 *
 * Реализации подписываются на SensorEvents.ReadingProcessed через @OnEvent
 * и пересылают payload своим протоколом. Интерфейс фиксирует контракт,
 * чтобы фидеры оставались взаимозаменяемыми.
 */
export interface Feeder {
  /** Стабильный идентификатор для диагностики / health-репортов. */
  readonly channel: string;

  publish(reading: ProcessedSensorReading): Promise<void>;
}
