import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import appConfig from './config/app.config';

/**
 * Точка входа NestJS-приложения.
 * Настраивает валидацию, swagger и запускает HTTP-сервер.
 *
 * @returns {Promise<void>}
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('sensors-connectivity')
      .setDescription('Multi-channel sensor data ingestion, processing and forwarding service.')
      .setVersion('0.0.1')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(config.swaggerPath, app, document);
  }

  await app.listen(config.port);
  logger.log(`HTTP server listening on http://localhost:${config.port}/`);
  if (config.swaggerEnabled) {
    logger.log(`Swagger docs at http://localhost:${config.port}/${config.swaggerPath}`);
  }
}

void bootstrap();
