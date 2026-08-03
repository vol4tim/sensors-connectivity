import { DynamicModule, Module } from '@nestjs/common';
import { PINATA_UPLOADER_CONFIG, PinataUploaderConfig } from './pinata-uploader.config';
import { PinataUploaderService } from './pinata-uploader.service';

/**
 * PinataUploader подключается через `PinataUploaderModule.register(config)`.
 */
@Module({})
export class PinataUploaderModule {
  /**
   * Регистрирует Pinata-аплоадер с заданным конфигом.
   *
   * @param {PinataUploaderConfig} config - Конфигурация Pinata.
   * @returns {DynamicModule} - Сконфигурированный DynamicModule.
   */
  static register(config: PinataUploaderConfig): DynamicModule {
    return {
      module: PinataUploaderModule,
      providers: [{ provide: PINATA_UPLOADER_CONFIG, useValue: config }, PinataUploaderService],
      exports: [PinataUploaderService],
    };
  }
}
