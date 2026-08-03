import { DynamicModule, Module } from '@nestjs/common';
import { LOCAL_IPFS_UPLOADER_CONFIG, LocalIpfsUploaderConfig } from './local-ipfs-uploader.config';
import { LocalIpfsUploaderService } from './local-ipfs-uploader.service';

/**
 * LocalIpfsUploader подключается через `LocalIpfsUploaderModule.register(config)`.
 */
@Module({})
export class LocalIpfsUploaderModule {
  /**
   * Регистрирует локальный IPFS-аплоадер с заданным конфигом.
   *
   * @param {LocalIpfsUploaderConfig} config - Конфигурация локального аплоадера.
   * @returns {DynamicModule} - Сконфигурированный DynamicModule.
   */
  static register(config: LocalIpfsUploaderConfig): DynamicModule {
    return {
      module: LocalIpfsUploaderModule,
      providers: [
        { provide: LOCAL_IPFS_UPLOADER_CONFIG, useValue: config },
        LocalIpfsUploaderService,
      ],
      exports: [LocalIpfsUploaderService],
    };
  }
}
