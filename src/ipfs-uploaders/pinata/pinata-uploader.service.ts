import { Inject, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import { IpfsUploader } from '../ipfs-uploader.base';
import { PINATA_UPLOADER_CONFIG, PinataUploaderConfig } from './pinata-uploader.config';

/**
 * IPFS-аплоадер через Pinata API.
 */
@Injectable()
export class PinataUploaderService extends IpfsUploader {
  readonly name = 'pinata';
  private readonly logger = new Logger(PinataUploaderService.name);

  /**
   * @param {PinataUploaderConfig} config - Конфиг Pinata (JWT, URL API).
   */
  constructor(@Inject(PINATA_UPLOADER_CONFIG) private readonly config: PinataUploaderConfig) {
    super();
    if (!config.jwt) {
      this.logger.warn('Pinata uploader enabled but IPFS_PINATA_JWT is empty — uploads will fail');
    }
  }

  /**
   * Загружает файл на Pinata и возвращает IPFS-хэш.
   *
   * @param {string} filePath - Абсолютный путь к файлу.
   * @returns {Promise<string>} - CID (IpfsHash) загруженного файла.
   * @throws {Error} - Если JWT не настроен или запрос неуспешен.
   */
  async upload(filePath: string): Promise<string> {
    if (!this.config.jwt) throw new Error('Pinata JWT is not configured');

    const data = await fs.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(data)]), basename(filePath));

    const res = await fetch(`${this.config.apiUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.jwt}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Pinata upload failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { IpfsHash?: string };
    if (!json.IpfsHash)
      throw new Error(`Pinata response missing IpfsHash: ${JSON.stringify(json)}`);
    return json.IpfsHash;
  }
}
