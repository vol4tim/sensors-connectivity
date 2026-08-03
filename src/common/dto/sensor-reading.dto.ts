import { ApiProperty } from '@nestjs/swagger';
import { ProcessedSensorReading } from '../interfaces/processed-sensor-reading.interface';

/** Public response shape для записи, прошедшей pipeline. */
export class SensorReadingDto implements ProcessedSensorReading {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'http' })
  station!: string;

  @ApiProperty({
    nullable: true,
    example: 'altruist',
    description: 'null если ни одно устройство не приняло маршрут.',
  })
  device!: string | null;

  @ApiProperty({ type: Object, description: 'Оригинальный payload, как пришёл со станции.' })
  rawPayload!: unknown;

  @ApiProperty({
    type: Object,
    nullable: true,
    description: 'Output устройства. null когда device=null.',
  })
  formattedPayload!: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  receivedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  processedAt!: Date;
}
