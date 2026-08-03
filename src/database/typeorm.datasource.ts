import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate / run / revert).
 * Application runtime uses TypeOrmModule.forRootAsync in DatabaseModule and does
 * NOT load this file.
 */
export default new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? './data/sensors-connectivity.sqlite',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
