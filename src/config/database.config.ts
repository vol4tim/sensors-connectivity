import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  path: string;
  synchronize: boolean;
  logging: boolean;
}

/**
 * Регистрирует конфигурацию SQLite-базы в NestJS ConfigModule.
 *
 * @returns {DatabaseConfig} - Загруженная конфигурация подключения к БД.
 */
export default registerAs<DatabaseConfig>('database', () => ({
  path: process.env.DB_PATH ?? './data/sensors-connectivity.sqlite',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));
