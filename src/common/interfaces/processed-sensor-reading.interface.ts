/**
 * Сохранённая запись после прохода через pipeline.
 *   `device` = null означает, что ни одно устройство не приняло маршрут;
 *   в этом случае `formattedPayload` тоже null и фидерам ничего не отправляется.
 */
export interface ProcessedSensorReading {
  id: string;
  station: string;
  device: string | null;
  rawPayload: unknown;
  formattedPayload: unknown;
  receivedAt: Date;
  processedAt: Date;
}
