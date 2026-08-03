import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from '../config/database.config';

/**
 * Подключает TypeORM к SQLite через async-фабрику, читающую конфиг из ConfigModule.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => ({
        type: 'better-sqlite3',
        database: db.path,
        synchronize: db.synchronize,
        logging: db.logging,
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
