import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { CoreModule } from './core/core.module';
import { DatabaseModule } from './database/database.module';
import { FeedersModule } from './feeders/feeders.module';
import { HealthModule } from './health/health.module';
import { IpfsUploadersModule } from './ipfs-uploaders/ipfs-uploaders.module';
import { StationsModule } from './stations/stations.module';

/**
 * Порядок imports важен:
 *   1. ConfigModule.forRoot() — синхронно грузит .env в process.env (dotenv).
 *   2. *.registerFromEnv() — читают process.env и собирают imports[] из включённых детей.
 *
 * DevicesModule подтягивается транзитом через CoreModule → PipelineModule.
 * IpfsUploadersModule global — доступен фидерам без явного импорта.
 * RobonomicsDatalogModule подключается как дочерний модуль DatalogFeeder
 * (см. DatalogFeederModule.register), поэтому отдельного импорта здесь нет.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    CoreModule,
    IpfsUploadersModule.registerFromEnv(),
    StationsModule.registerFromEnv(),
    FeedersModule.registerFromEnv(),
    HealthModule,
  ],
})
export class AppModule {}
