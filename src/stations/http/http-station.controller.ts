import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SensorReadingDto } from '../../common/dto/sensor-reading.dto';
import { PipelineService } from '../../core/pipeline/pipeline.service';

const HTTP_STATION_CHANNEL = 'http';

@ApiTags('http')
@Controller()
export class HttpStationController {
  /**
   * @param {PipelineService} pipeline - Общий pipeline для приёма и обработки сообщений.
   */
  constructor(private readonly pipeline: PipelineService) {}

  /**
   * Принимает произвольный JSON от HTTP-клиента и отправляет его в pipeline.
   *
   * @param {Record<string, unknown>} body - Тело POST-запроса.
   * @returns {Promise<SensorReadingDto>} - Обработанная запись, возвращаемая клиенту.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Принять произвольный JSON. Маршрут на Device выбирается по содержимому payload.',
    description:
      '200 OK подтверждает локальную проверку и форматирование. ' +
      'Доставка через Feeder выполняется асинхронно и этим ответом не подтверждается.',
  })
  @ApiBody({
    description:
      'Любой JSON-объект. Например, для Altruist обязательны robonomics_address, owner, signature, sensordatavalues, GPS_lat, GPS_lon.',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiOkResponse({
    description: 'Сообщение проверено и отформатировано локально.',
    type: SensorReadingDto,
  })
  async ingest(@Body() body: Record<string, unknown>): Promise<SensorReadingDto> {
    return this.pipeline.ingest({
      station: HTTP_STATION_CHANNEL,
      payload: body,
      receivedAt: new Date(),
    });
  }
}
