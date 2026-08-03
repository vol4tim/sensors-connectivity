import { Module } from '@nestjs/common';
import { DevicesModule } from '../../devices/devices.module';
import { PipelineService } from './pipeline.service';

/**
 * Модуль pipeline: единый сервис приёма данных и подключённый реестр Device.
 */
@Module({
  imports: [DevicesModule],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
