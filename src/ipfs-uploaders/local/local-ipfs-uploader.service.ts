import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { KuboRPCClient } from 'kubo-rpc-client';
import { promises as fs } from 'node:fs';
import { IpfsUploader } from '../ipfs-uploader.base';
import { LOCAL_IPFS_UPLOADER_CONFIG, LocalIpfsUploaderConfig } from './local-ipfs-uploader.config';

// kubo-rpc-client — ESM-only; project — CJS. Прямой import() tsc понизит до require().
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const esmImport = new Function('s', 'return import(s)') as <T>(s: string) => Promise<T>;

/**
 * Локальный IPFS-аплоадер через Kubo RPC API.
 */
@Injectable()
export class LocalIpfsUploaderService extends IpfsUploader implements OnModuleInit {
  readonly name = 'local';
  private readonly logger = new Logger(LocalIpfsUploaderService.name);
  private client?: KuboRPCClient;

  /**
   * @param {LocalIpfsUploaderConfig} config - Конфиг локальной ноды Kubo.
   */
  constructor(
    @Inject(LOCAL_IPFS_UPLOADER_CONFIG) private readonly config: LocalIpfsUploaderConfig,
  ) {
    super();
  }

  /**
   * Лениво импортирует kubo-rpc-client и инициализирует RPC-клиент.
   *
   * @returns {Promise<void>}
   */
  async onModuleInit(): Promise<void> {
    try {
      const { create } = await esmImport<typeof import('kubo-rpc-client')>('kubo-rpc-client');
      this.client = create(this.config.apiUrl);
      this.logger.log(`Local IPFS uploader ready at ${this.config.apiUrl}`);
    } catch (e) {
      this.logger.error(
        `Local IPFS uploader init failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Загружает файл в локальную ноду Kubo и возвращает CID.
   *
   * @param {string} filePath - Абсолютный путь к файлу.
   * @returns {Promise<string>} - CID загруженного файла.
   * @throws {Error} - Если клиент не инициализирован.
   */
  async upload(filePath: string): Promise<string> {
    if (!this.client) throw new Error('Local IPFS client not initialised');
    const content = await fs.readFile(filePath);
    const result = await this.client.add(content);
    return result.cid.toString();
  }
}
