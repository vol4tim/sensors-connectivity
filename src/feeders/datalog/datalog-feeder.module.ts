import { DynamicModule, Module } from '@nestjs/common';
import { DATALOG_FEEDER_CONFIG, DatalogFeederConfig } from './datalog-feeder.config';
import { DatalogFeederService } from './datalog-feeder.service';
import { RobonomicsDatalogModule } from './robonomics/robonomics-datalog.module';

/**
 * DatalogFeeder подключается через `DatalogFeederModule.register(config)`.
 * Сервис подписан на SensorEvents.ReadingProcessed (@OnEvent) — EventEmitter
 * глобальный, импортировать его здесь не нужно.
 *
 * RobonomicsDatalogModule включается как дочерний только если родитель включён
 * (т.е. этот register() вызван из FeedersModule.registerFromEnv).
 */
@Module({})
export class DatalogFeederModule {
  /**
   * Регистрирует DatalogFeeder с заданным конфигом и подключает RobonomicsDatalogModule.
   *
   * @param {DatalogFeederConfig} config - Конфигурация фидера.
   * @returns {DynamicModule} - Сконфигурированный DynamicModule.
   */
  static register(config: DatalogFeederConfig): DynamicModule {
    return {
      module: DatalogFeederModule,
      imports: [RobonomicsDatalogModule.registerFromEnv()],
      providers: [{ provide: DATALOG_FEEDER_CONFIG, useValue: config }, DatalogFeederService],
      exports: [DatalogFeederService],
    };
  }
}
