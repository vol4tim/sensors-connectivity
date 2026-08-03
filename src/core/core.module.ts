import { Module } from '@nestjs/common';
import { PipelineModule } from './pipeline/pipeline.module';

/**
 * Доменный слой: pipeline (приём → device → event).
 * Без персистентности — readings никуда не сохраняются.
 */
@Module({
  imports: [PipelineModule],
  exports: [PipelineModule],
})
export class CoreModule {}
