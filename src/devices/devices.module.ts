import { Module } from '@nestjs/common';
import { Device } from '../common/device.base';
import { AltruistDevice } from './altruist/altruist.device';
import { AltruistModule } from './altruist/altruist.module';
import { DeviceRegistry } from './device-registry.service';

/**
 * Aggregator всех Device-форматтеров.
 *
 * DeviceRegistry собирается factory-провайдером: в `inject` перечисляются
 * классы всех зарегистрированных устройств — они приезжают как аргументы
 * в тех же позициях.
 *
 * Чтобы добавить новое устройство:
 *   1. Создать <name>.module.ts + <name>.device.ts (extends Device).
 *   2. Импортировать модуль в `imports` ниже.
 *   3. Добавить класс устройства в `inject` ниже.
 */
@Module({
  imports: [AltruistModule],
  providers: [
    {
      provide: DeviceRegistry,
      inject: [AltruistDevice],
      useFactory: (...devices: Device[]) => new DeviceRegistry(devices),
    },
  ],
  exports: [DeviceRegistry],
})
export class DevicesModule {}
