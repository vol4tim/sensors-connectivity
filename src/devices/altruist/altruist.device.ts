import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Device } from '../../common/device.base';
import { RawSensorReading } from '../../common/interfaces/raw-sensor-reading.interface';
import { ALTRUIST_DEVICE_CONFIG, AltruistDeviceConfig } from './altruist-device.config';
import { AltruistSignatureVerifier } from './altruist-signature.service';
import {
  ALTRUIST_SENSOR_FIELDS,
  AltruistEntry,
  AltruistInput,
  AltruistMeasurement,
  AltruistOutput,
} from './altruist.types';
import { parseSensorDataValues } from './sensordatavalues.parser';

const ROUTER_FIELD = 'robonomics_address';

const REQUIRED_FIELDS = [
  'robonomics_address',
  'owner',
  'signature',
  'sensordatavalues',
  'GPS_lat',
  'GPS_lon',
] as const;

/** 1 мм рт. ст. = 133.322 Pa. */
const PA_PER_MMHG = 133.322;

/**
 * Явный маппинг ключей sensordatavalues на имена полей AltruistMeasurement.
 * Нужен только тогда, когда ключ не совпадает с именем поля.
 * Ключи, совпадающие с именем поля, обрабатываются дефолтным сеттером автоматически.
 */
const SENSOR_KEY_TO_FIELD: Record<string, keyof AltruistMeasurement> = {
  t: 'temperature',
  h: 'humidity',
  p1: 'pm10',
  p2: 'pm25',
  nm: 'noiseMax',
  na: 'noiseAvg',
  gc: 'radiation',
  co: 'CO',
  co1: 'CO',
  co2: 'CO2',
  vc: 'TVOC',
};

const ENCRYPTED_VALUE_PREFIX = 'e.';

/** Проверяет, что значение — зашифрованная строка, которую нельзя преобразовывать. */
function isEncryptedSensorValue(value: number | string): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_VALUE_PREFIX);
}

/** Преобразует числовое или строковое значение во float. Зашифрованные строки не конвертирует. */
function toSensorFloat(value: number | string): number {
  return typeof value === 'number' ? value : parseFloat(value);
}

/** Нормализует значение: зашифрованные строки оставляет как есть, остальное — во float. */
function coerceSensorValue(value: number | string): number | string {
  return isEncryptedSensorValue(value) ? value : toSensorFloat(value);
}

/** Поля, которые нельзя перезаписывать из sensordatavalues. */
const READONLY_FIELDS = new Set<keyof AltruistMeasurement>(['timestamp']);

/** Все опциональные поля AltruistMeasurement, кроме readonly. */
const ALLOWED_FIELDS = new Set<keyof AltruistMeasurement>(ALTRUIST_SENSOR_FIELDS);

/** Поля AltruistMeasurement, которые можно заполнять из sensordatavalues. */
type WritableSensorField = Exclude<keyof AltruistMeasurement, 'timestamp'>;

/** Дефолтный сеттер: кладёт нормализованное значение в соответствующее поле измерения. */
const DEFAULT_SETTER = (
  measurement: AltruistMeasurement,
  key: string,
  value: number | string,
): void => {
  const field = (SENSOR_KEY_TO_FIELD[key] ?? key) as WritableSensorField;

  if (READONLY_FIELDS.has(field)) return;
  if (ALLOWED_FIELDS.has(field)) {
    measurement[field] = coerceSensorValue(value);
  }
};

/**
 * Возвращает сеттер для ключа из sensordatavalues.
 * Для `p` применяется конверсия давления из Па в мм рт. ст.;
 * для остальных ключей используется DEFAULT_SETTER.
 */
const getSensorSetter = (key: string): ((m: AltruistMeasurement, v: number | string) => void) => {
  if (key === 'p') {
    return (m: AltruistMeasurement, v: number | string) => {
      m.pressure = isEncryptedSensorValue(v)
        ? v
        : Math.round((toSensorFloat(v) / PA_PER_MMHG) * 100) / 100;
    };
  }

  return (m: AltruistMeasurement, v: number | string) => DEFAULT_SETTER(m, key, v);
};

const HEX_RE = /^[0-9a-fA-F]+$/;

/**
 * Device-форматтер для Altruist-сенсоров.
 * Валидирует payload, проверяет ED25519-подпись и превращает sensordatavalues
 * в канонический измерительный блок.
 */
@Injectable()
export class AltruistDevice extends Device {
  readonly type = 'altruist';

  /**
   * @param {AltruistSignatureVerifier} signatures - Сервис проверки подписи Altruist.
   * @param {AltruistDeviceConfig} config - Конфигурация Altruist-устройства.
   */
  constructor(
    private readonly signatures: AltruistSignatureVerifier,
    @Inject(ALTRUIST_DEVICE_CONFIG)
    private readonly config: AltruistDeviceConfig,
  ) {
    super();
  }

  /**
   * Определяет, может ли этот Device обработать входящее сообщение.
   * Проверяет, что payload — объект и содержит непустое поле `robonomics_address`.
   *
   * @param {RawSensorReading} raw - Сырое сообщение со станции.
   * @returns {boolean} - true, если устройство принимает маршрут.
   */
  match(raw: RawSensorReading): boolean {
    const payload = raw.payload;
    if (!payload || typeof payload !== 'object') return false;
    const v = (payload as Record<string, unknown>)[ROUTER_FIELD];
    return typeof v === 'string' && v.length > 0;
  }

  /**
   * Форматирует Altruist payload в канонический output вида `{ address: entry }`.
   * Выполняет валидацию полей, проверку подписи и преобразование sensordatavalues.
   *
   * @param {RawSensorReading} raw - Сырое сообщение со станции.
   * @returns {AltruistOutput} - Отформатированный словарь по адресам.
   */
  format(raw: RawSensorReading): AltruistOutput {
    const input = this.assertValid(raw.payload);
    this.assertSignature(input);

    const normalizedSensorDataValues = this.normalizeLegacyCoKey(
      input.robonomics_address,
      input.sensordatavalues,
    );

    const entry: AltruistEntry = {
      model: 2,
      geo: `${input.GPS_lat},${input.GPS_lon}`,
      signature: input.signature,
      measurement: this.buildMeasurement(normalizedSensorDataValues),
    };
    if (input.donated_by !== undefined) entry.donated_by = input.donated_by;

    return { [input.robonomics_address]: entry };
  }

  /**
   * Нормализует ключ `co`/`co2` для legacy-сенсоров.
   *
   * Правило:
   *   - если в данных есть `co2` и нет `co` — оставляем как есть;
   *   - иначе, если сенсор в списке legacy и есть `co` — заменяем `co` на `co2`;
   *   - иначе — оставляем как есть.
   *
   * @param {string} sensorId - Идентификатор сенсора (robonomics_address).
   * @param {string} sensorDataValues - Исходная строка sensordatavalues.
   * @returns {string} - Нормализованная строка sensordatavalues.
   */
  private normalizeLegacyCoKey(sensorId: string, sensorDataValues: string): string {
    const hasCo2 = sensorDataValues.includes('co2:');
    const hasCo = /(^|,)co:/.test(sensorDataValues);

    // Если сенсор уже шлёт правильный ключ co2 — ничего не маппим.
    if (hasCo2) {
      return sensorDataValues;
    }

    const isLegacy = this.config.legacySensorIds.includes(sensorId);
    if (isLegacy && hasCo) {
      // Заменяем только точный ключ "co:", не трогая "co1:" и т.п.
      return sensorDataValues.replace(/(^|,)co:/g, '$1co2:');
    }

    return sensorDataValues;
  }

  /**
   * Проверяет цифровую подпись Altruist по sensordatavalues и адресу подписанта.
   *
   * @param {AltruistInput} input - Валидированный вход Altruist.
   * @returns {void}
   * @throws {BadRequestException} - Если подпись не валидна.
   */
  private assertSignature(input: AltruistInput): void {
    const ok = this.signatures.verify(
      input.sensordatavalues,
      input.signature,
      input.robonomics_address,
    );
    if (!ok) {
      throw new BadRequestException('Altruist: invalid signature');
    }
  }

  /**
   * Валидирует структуру и типы Altruist payload.
   *
   * @param {unknown} payload - Произвольный payload из RawSensorReading.
   * @returns {AltruistInput} - Приведённый к типу валидный вход.
   * @throws {BadRequestException} - При отсутствии/неверном обязательном поле.
   */
  private assertValid(payload: unknown): AltruistInput {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Altruist: payload must be an object');
    }
    const p = payload as Record<string, unknown>;

    const missing = REQUIRED_FIELDS.filter(
      (f) => p[f] === undefined || p[f] === null || p[f] === '',
    );
    if (missing.length > 0) {
      throw new BadRequestException(`Altruist: missing required fields: ${missing.join(', ')}`);
    }

    if (typeof p.robonomics_address !== 'string') {
      throw new BadRequestException('Altruist: robonomics_address must be string');
    }
    if (typeof p.owner !== 'string') {
      throw new BadRequestException('Altruist: owner must be string');
    }
    if (typeof p.signature !== 'string' || !HEX_RE.test(p.signature)) {
      throw new BadRequestException('Altruist: signature must be hex string without 0x prefix');
    }
    if (typeof p.sensordatavalues !== 'string') {
      throw new BadRequestException('Altruist: sensordatavalues must be string');
    }
    if (typeof p.GPS_lat !== 'number' || !Number.isFinite(p.GPS_lat)) {
      throw new BadRequestException('Altruist: GPS_lat must be a finite number');
    }
    if (typeof p.GPS_lon !== 'number' || !Number.isFinite(p.GPS_lon)) {
      throw new BadRequestException('Altruist: GPS_lon must be a finite number');
    }
    if (p.device_model !== undefined && typeof p.device_model !== 'string') {
      throw new BadRequestException('Altruist: device_model must be string when present');
    }
    if (p.donated_by !== undefined && typeof p.donated_by !== 'string') {
      throw new BadRequestException('Altruist: donated_by must be string when present');
    }

    return p as unknown as AltruistInput;
  }

  /**
   * Парсит строку sensordatavalues и строит объект AltruistMeasurement,
   * применяя конверсию давления из паскалей в мм рт. ст.
   *
   * @param {string} sensorDataValues - Исходная строка sensordatavalues.
   * @returns {AltruistMeasurement} - Объект измерения с timestamp и заполненными полями.
   */
  private buildMeasurement(sensorDataValues: string): AltruistMeasurement {
    const measurement: AltruistMeasurement = {
      timestamp: Math.floor(Date.now() / 1000),
    };

    const parsed = parseSensorDataValues(sensorDataValues);
    for (const [key, value] of Object.entries(parsed)) {
      getSensorSetter(key)(measurement, value);
    }

    return measurement;
  }
}
