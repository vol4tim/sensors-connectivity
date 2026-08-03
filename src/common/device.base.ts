import { RawSensorReading } from './interfaces/raw-sensor-reading.interface';

/**
 * Базовый класс для всех Device-форматтеров.
 *
 * Жизненный цикл в pipeline:
 *   1. PipelineService находит первое устройство, у которого `match(raw)` вернул true.
 *   2. Вызывает `format(raw)` — устройство валидирует и преобразует payload в свой output shape.
 *   3. Если match не дал результата — данные сохраняются как raw, без формирования и без события.
 *
 * Контракт:
 *   - `match()` дешёвый: проверяет наличие маршрутизирующих полей.
 *   - `format()` делает полную валидацию и бросает `BadRequestException`
 *     (или подкласс) на невалидном входе — исключение пропустится наверх до контроллера.
 */
export abstract class Device {
  /** Стабильный идентификатор устройства, попадает в поле `device` ProcessedSensorReading. */
  abstract readonly type: string;

  /**
   * Проверяет, подходит ли это устройство для обработки сообщения.
   *
   * @param {RawSensorReading} raw - Сырое сообщение со станции.
   * @returns {boolean} - true, если устройство может обработать сообщение.
   */
  abstract match(raw: RawSensorReading): boolean;

  /**
   * Преобразует сообщение в канонический output-формат устройства.
   *
   * @param {RawSensorReading} raw - Сырое сообщение со станции.
   * @returns {unknown | Promise<unknown>} - Синхронный или асинхронный результат форматирования.
   * @throws {import('@nestjs/common').BadRequestException} - При невалидном входе.
   */
  abstract format(raw: RawSensorReading): unknown | Promise<unknown>; // eslint-disable-line @typescript-eslint/no-redundant-type-constituents
}
