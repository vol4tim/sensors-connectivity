import { DynamicModule, Logger, Module } from '@nestjs/common';
import { loadDatalogFeederConfig } from './datalog/datalog-feeder.config';
import { DatalogFeederModule } from './datalog/datalog-feeder.module';
import { loadPubsubFeederConfig } from './pubsub/pubsub-feeder.config';
import { PubsubFeederModule } from './pubsub/pubsub-feeder.module';

/**
 * Aggregator всех фидеров (output adapters).
 *
 * `registerFromEnv()` подключает только включённые фидеры. Каждый фидер
 * привозит собственный конфиг (interface + sync env-loader + DI-токен)
 * и подписывается на SensorEvents.ReadingProcessed.
 */
@Module({})
export class FeedersModule {
  private static readonly logger = new Logger(FeedersModule.name);

  /**
   * Собирает модуль фидеров, включая только те, что активированы через env.
   *
   * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
   * @returns {DynamicModule} - Aggregator-модуль включённых фидеров.
   */
  static registerFromEnv(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const enabled: DynamicModule[] = [];

    const pubsub = loadPubsubFeederConfig(env);
    if (pubsub.enabled) {
      enabled.push(PubsubFeederModule.register(pubsub));
    }

    const datalog = loadDatalogFeederConfig(env);
    if (datalog.enabled) {
      enabled.push(DatalogFeederModule.register(datalog));
    }

    FeedersModule.logger.log(
      `Enabled feeders: ${
        enabled.length === 0
          ? '(none)'
          : enabled.map((m) => (m.module as { name?: string }).name ?? '?').join(', ')
      }`,
    );

    return {
      module: FeedersModule,
      imports: enabled,
    };
  }
}
