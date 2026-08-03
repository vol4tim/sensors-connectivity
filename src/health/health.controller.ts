import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

/**
 * Контроллер health-чеков.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * @param {HealthCheckService} health - Сервис NestJS Terminus для health-чеков.
   * @param {TypeOrmHealthIndicator} db - Индикатор доступности БД TypeORM.
   */
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /**
   * Возвращает статус здоровья приложения, включая пинг БД.
   *
   * @returns {unknown} - Результат health-чека Terminus.
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
