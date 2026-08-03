import { DynamicModule, Logger, Module } from '@nestjs/common';
import { loadHttpStationConfig } from './http/http-station.config';
import { HttpStationModule } from './http/http-station.module';

/**
 * Aggregator всех станций (input adapters).
 *
 * `registerFromEnv()` собирает в imports только те станции, у которых
 * флаг `enabled` истинен в env-конфиге. Вызывается в decorator-метаданных
 * AppModule после ConfigModule.forRoot() — process.env к этому моменту
 * уже заполнен значениями из .env.
 */
@Module({})
export class StationsModule {
  private static readonly logger = new Logger(StationsModule.name);

  /**
   * Собирает модуль станций, включая только те, что активированы через env.
   *
   * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
   * @returns {DynamicModule} - Aggregator-модуль включённых станций.
   */
  static registerFromEnv(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const enabled: DynamicModule[] = [];

    const http = loadHttpStationConfig(env);
    if (http.enabled) {
      enabled.push(HttpStationModule.register(http));
    }

    StationsModule.logger.log(
      `Enabled stations: ${
        enabled.length === 0
          ? '(none)'
          : enabled.map((m) => (m.module as { name?: string }).name ?? '?').join(', ')
      }`,
    );

    return {
      module: StationsModule,
      imports: enabled,
    };
  }
}
