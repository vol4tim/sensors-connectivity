/**
 * Station — input adapter, принимает данные по своему протоколу
 * (HTTP, MQTT, COM port, ...) и пушит их в pipeline.
 *
 * Маркер-интерфейс для диагностики / реестра активных каналов.
 * Сами станции реализуются как обычные NestJS-модули и инжектят PipelineService.
 */
export interface Station {
  /** Стабильный идентификатор канала (e.g. 'http', 'mqtt', 'com'). */
  readonly channel: string;
}
