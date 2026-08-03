/** Сырой вход, пришедший через HTTPStation для Altruist-устройства. */
export interface AltruistInput {
  robonomics_address: string;
  owner: string;
  signature: string;
  sensordatavalues: string;
  GPS_lat: number;
  GPS_lon: number;
  device_model?: string;
  donated_by?: string;
  software_version?: string;
}

/** Список измерительных полей AltruistMeasurement. Источник правды для типа и для рантайм-проверок. */
export const ALTRUIST_SENSOR_FIELDS = [
  'temperature',
  'pressure',
  'humidity',
  'pm10',
  'pm25',
  'noiseMax',
  'noiseAvg',
  'radiation',
  'CO2',
  'TVOC',
  'CO',
  'o3',
  'no2',
] as const;

/**
 * Канонический блок измерения, который выдаёт AltruistDevice.
 * Маппинг ключей sensordatavalues → этих полей задаётся в altruist.device.ts.
 */
export type AltruistMeasurement = {
  /** Unix timestamp в секундах, серверное время на момент format'а. */
  timestamp: number;
} & {
  [K in (typeof ALTRUIST_SENSOR_FIELDS)[number]]?: number | string;
};

export interface AltruistEntry {
  /** константа Altruist */
  model: 2;
  /** "<lat>,<lon>". */
  geo: string;
  donated_by?: string;
  signature: string;
  measurement: AltruistMeasurement;
}

/** Финальный output Altruist'а: словарь, ключ — robonomics_address. */
export type AltruistOutput = Record<string, AltruistEntry>;
