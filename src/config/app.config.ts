import { registerAs } from '@nestjs/config';

export type NodeEnv = 'development' | 'production' | 'test';

export interface AppConfig {
  port: number;
  nodeEnv: NodeEnv;
  swaggerEnabled: boolean;
  swaggerPath: string;
}

/**
 * Регистрирует глобальную конфигурацию приложения в NestJS ConfigModule.
 *
 * @returns {AppConfig} - Загруженная конфигурация приложения.
 */
export default registerAs<AppConfig>('app', () => ({
  port: parseInt(process.env.APP_PORT ?? '3000', 10),
  nodeEnv: (process.env.NODE_ENV as NodeEnv) ?? 'development',
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
}));
