import { DynamicModule, Module } from '@nestjs/common';
import { PUBSUB_FEEDER_CONFIG, PubsubFeederConfig } from './pubsub-feeder.config';
import { PubsubFeederService } from './pubsub-feeder.service';

/**
 * PubsubFeeder подключается через `PubsubFeederModule.register(config)`.
 * Сервис подписан на SensorEvents.ReadingProcessed (@OnEvent) — EventEmitter
 * глобальный, импортировать его здесь не нужно.
 */
@Module({})
export class PubsubFeederModule {
  /**
   * Регистрирует PubsubFeeder с заданным конфигом.
   *
   * @param {PubsubFeederConfig} config - Конфигурация pubsub-фидера.
   * @returns {DynamicModule} - Сконфигурированный DynamicModule.
   */
  static register(config: PubsubFeederConfig): DynamicModule {
    return {
      module: PubsubFeederModule,
      providers: [{ provide: PUBSUB_FEEDER_CONFIG, useValue: config }, PubsubFeederService],
      exports: [PubsubFeederService],
    };
  }
}
