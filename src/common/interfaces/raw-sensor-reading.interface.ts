/**
 * Envelope, который каждая станция (HTTP, MQTT, COM port, ...) пушит в pipeline.
 * Конкретная структура `payload` определяется станцией и интерпретируется Device'ом
 * по маршрутизирующим полям внутри.
 */
export interface RawSensorReading {
  /** Канал станции, принявшей данные: 'http', 'mqtt', 'serial', ... */
  station: string;

  /** Произвольный JSON-объект, как пришло от устройства/клиента. */
  payload: unknown;

  /** Время приёма станцией. */
  receivedAt: Date;

  /** Метаданные канала-источника (топик, заголовки, идентификатор сессии и т.п.). */
  metadata?: Record<string, unknown>;
}
