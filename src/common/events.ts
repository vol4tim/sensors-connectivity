/** Сенсорный пайплайн: данные станций → device → save → emit. */
export const SensorEvents = {
  ReadingProcessed: 'sensor.reading.processed',
} as const;

/** Downstream-события хранения/анкоринга. */
export const StorageEvents = {
  /** Файл с агрегированным payload'ом залит в IPFS. payload: { cid, uploader } */
  IpfsUploaded: 'storage.ipfs.uploaded',
} as const;

export type SensorEventName = (typeof SensorEvents)[keyof typeof SensorEvents];
export type StorageEventName = (typeof StorageEvents)[keyof typeof StorageEvents];

/** Payload события StorageEvents.IpfsUploaded. */
export interface IpfsUploadedPayload {
  cid: string;
  /** Имена аплоадеров, успешно вернувших этот CID. */
  uploaders: string[];
}
