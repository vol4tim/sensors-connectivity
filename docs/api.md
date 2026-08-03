# REST API

## Глобальные параметры

- Swagger UI: `/docs` (если `SWAGGER_ENABLED=true`)
- Health: `/health`

## Эндпоинты

### `POST /`

Принимает произвольный JSON от сенсора. Входящий payload маршрутизируется в `PipelineService`, который подбирает подходящий `Device` (например, `AltruistDevice`, если присутствует поле `robonomics_address`).

#### Запрос

Тело — любой объект. Swagger описывает его как `additionalProperties: true`.

Пример для `AltruistDevice`:

```json
{
  "robonomics_address": "4H1...",
  "owner": "4G8...",
  "signature": "a1b2c3...",
  "sensordatavalues": "nm:0.00,na:0.00,t:23.4,p:101325,h:55,p1:10,p2:5,co1:0.3",
  "GPS_lat": 55.75,
  "GPS_lon": 37.61,
  "donated_by": "owner-name"
}
```

#### Ответ

`200 OK` — запись прошла локальную проверку и форматирование в pipeline.
Доставка через feeder'ы выполняется асинхронно и этим ответом не подтверждается.
После появления надёжной очереди контракт можно будет изменить на `202 Accepted` после подтверждения записи в очередь.

```json
{
  "id": "a1b2c3d4-...",
  "station": "http",
  "device": "altruist",
  "rawPayload": { ... },
  "formattedPayload": { "4H1...": { "model": 2, "geo": "55.75,37.61", ... } },
  "receivedAt": "2026-07-16T11:00:00.000Z",
  "processedAt": "2026-07-16T11:00:00.050Z"
}
```

Если `device` равен `null`, значит ни один зарегистрированный `Device` не принял payload (отсутствуют маршрутизирующие поля). В таком случае `formattedPayload` тоже `null`, и фидеры не получают событие.

#### Возможные ошибки

| Статус | Причина |
|--------|---------|
| `400 Bad Request` | `AltruistDevice` не прошёл валидацию: отсутствуют обязательные поля, неверная подпись, невалидные `GPS_lat`/`GPS_lon` и т.д. |
| `400 Bad Request` | Глобальный `ValidationPipe` отклонил поля, не разрешённые DTO (актуально для DTO с фиксированной схемой). |

### `GET /health`

Health check через `@nestjs/terminus`. Проверяет доступность SQLite (`TypeOrmHealthIndicator`).

#### Ответ

`200 OK`

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" }
  }
}
```
