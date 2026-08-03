import { Module } from '@nestjs/common';
import { AltruistDevice } from './altruist.device';
import { AltruistSignatureVerifier } from './altruist-signature.service';
import { ALTRUIST_DEVICE_CONFIG, loadAltruistDeviceConfig } from './altruist-device.config';

/**
 * Модуль Altruist-устройства: Device-форматтер и сервис проверки подписи.
 */
@Module({
  providers: [
    AltruistSignatureVerifier,
    {
      provide: ALTRUIST_DEVICE_CONFIG,
      useValue: loadAltruistDeviceConfig(),
    },
    AltruistDevice,
  ],
  exports: [AltruistDevice],
})
export class AltruistModule {}
