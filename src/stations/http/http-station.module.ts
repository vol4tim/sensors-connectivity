import { DynamicModule, Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { HttpStationController } from './http-station.controller';
import { HTTP_STATION_CONFIG, HttpStationConfig } from './http-station.config';

/**
 * HTTPStation подключается через `HttpStationModule.register(config)`.
 * Конфиг доступен любому провайдеру через `@Inject(HTTP_STATION_CONFIG)`.
 */
@Module({})
export class HttpStationModule {
  /**
   * Регистрирует HTTP-станцию с заданным конфигом.
   *
   * @param {HttpStationConfig} config - Конфигурация включения/выключения станции.
   * @returns {DynamicModule} - Сконфигурированный DynamicModule.
   */
  static register(config: HttpStationConfig): DynamicModule {
    return {
      module: HttpStationModule,
      imports: [CoreModule],
      controllers: [HttpStationController],
      providers: [{ provide: HTTP_STATION_CONFIG, useValue: config }],
      exports: [HTTP_STATION_CONFIG],
    };
  }
}
