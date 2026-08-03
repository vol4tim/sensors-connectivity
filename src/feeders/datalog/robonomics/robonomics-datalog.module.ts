import { DynamicModule, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatalogRecordService } from './datalog-record.service';
import { DatalogRecordEntity } from './entities/datalog-record.entity';
import { RobonomicsChainService } from './robonomics-chain.service';
import {
  ROBONOMICS_DATALOG_CONFIG,
  loadRobonomicsDatalogConfig,
} from './robonomics-datalog.config';
import { RobonomicsDatalogService } from './robonomics-datalog.service';

/**
 * Robonomics-datalog submodule — дочерний модуль DatalogFeeder.
 *
 * Включается только если оба условия истинны:
 *   1. DatalogFeeder включён (родительский фидер вызвал registerFromEnv).
 *   2. ROBONOMICS_DATALOG_ENABLED=true.
 *
 * Когда модуль выключен — entity не подключается, таблица не создаётся,
 * событие IpfsUploaded остаётся без слушателя (DatalogFeeder просто логирует CIDы).
 */
@Module({})
export class RobonomicsDatalogModule {
  private static readonly logger = new Logger(RobonomicsDatalogModule.name);

  /**
   * Регистрирует модуль из env, если Robonomics datalog включён.
   *
   * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
   * @returns {DynamicModule} - Либо полный модуль, либо пустой заглушка при отключении.
   */
  static registerFromEnv(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const config = loadRobonomicsDatalogConfig(env);

    if (!config.enabled) {
      RobonomicsDatalogModule.logger.log('Robonomics datalog disabled');
      return { module: RobonomicsDatalogModule };
    }
    if (!config.mnemonic) {
      RobonomicsDatalogModule.logger.warn(
        'Robonomics datalog enabled but ROBONOMICS_MNEMONIC is empty — submits will fail',
      );
    }

    return {
      module: RobonomicsDatalogModule,
      imports: [TypeOrmModule.forFeature([DatalogRecordEntity])],
      providers: [
        { provide: ROBONOMICS_DATALOG_CONFIG, useValue: config },
        DatalogRecordService,
        RobonomicsChainService,
        RobonomicsDatalogService,
      ],
    };
  }
}
