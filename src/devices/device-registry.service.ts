import { Injectable, Logger } from '@nestjs/common';
import { Device } from '../common/device.base';
import { RawSensorReading } from '../common/interfaces/raw-sensor-reading.interface';

/**
 * Реестр всех зарегистрированных Device-форматтеров.
 * Список собирается factory-провайдером в DevicesModule — туда добавляются
 * новые устройства по мере появления их модулей.
 */
@Injectable()
export class DeviceRegistry {
  private readonly logger = new Logger(DeviceRegistry.name);

  /**
   * @param {Device[]} devices - Массив зарегистрированных Device-форматтеров.
   */
  constructor(private readonly devices: Device[]) {
    this.logger.log(
      `Registered devices: ${
        devices.length === 0 ? '(none)' : devices.map((d) => d.type).join(', ')
      }`,
    );
  }

  /**
   * Возвращает первое устройство, чей match() принял сообщение.
   *
   * @param {RawSensorReading} raw - Сырое сообщение со станции.
   * @returns {Device | undefined} - Найденный Device или undefined.
   */
  find(raw: RawSensorReading): Device | undefined {
    return this.devices.find((d) => d.match(raw));
  }
}
