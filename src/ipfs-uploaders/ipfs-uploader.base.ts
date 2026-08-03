/**
 * Базовый класс для всех IPFS-аплоадеров (локальная нода, Pinata, Crust, ...).
 * Реализации регистрируются в IpfsUploaderRegistry через factory-провайдер
 * IpfsUploadersModule.
 */
export abstract class IpfsUploader {
  /** Стабильный идентификатор аплоадера: 'local', 'pinata', 'crust', ... */
  abstract readonly name: string;

  /**
   * Загружает файл по пути и возвращает CID.
   *
   * @param {string} filePath - Абсолютный путь к файлу.
   * @returns {Promise<string>} - CID загруженного файла.
   * @throws {Error} - При ошибке загрузки.
   */
  abstract upload(filePath: string): Promise<string>;
}
