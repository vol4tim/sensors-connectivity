# Путь входящего сообщения через приложение

Этот документ описывает, как входящее сообщение проходит через `sensors-connectivity` от момента приёма до момента вывода наружу. Описание привязано к конкретным модулям, классам и функциям/методам.

## Пример сообщения

Рассмотрим типичный HTTP-запрос с JSON, который попадает под форматтер `AltruistDevice`:

```json
POST /
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

## 1. HTTP-станция принимает запрос

**Модуль:** `src/stations/http/http-station.module.ts`
**Класс:** `HttpStationController`
**Файл:** `src/stations/http/http-station.controller.ts`
**Метод:** `ingest(@Body() body: Record<string, unknown>): Promise<SensorReadingDto>`

Что происходит:

1. NestJS маршрутизирует POST-запрос на корневой путь `/`.
2. Метод `ingest` принимает произвольный JSON и оборачивает его в `RawSensorReading`:
   ```ts
   { station: 'http', payload: body, receivedAt: new Date() }
   ```
3. Эта структура передаётся в единую точку входа — `PipelineService.ingest()`.

## 2. Pipeline — единая точка приёма

**Модуль:** `src/core/pipeline/pipeline.module.ts`
**Класс:** `PipelineService`
**Файл:** `src/core/pipeline/pipeline.service.ts`
**Метод:** `ingest(raw: RawSensorReading): Promise<ProcessedSensorReading>`

Что происходит:

1. `PipelineService.ingest(raw)` вызывает `DeviceRegistry.find(raw)`.
2. `DeviceRegistry.find` перебирает зарегистрированные `Device` и вызывает у каждого `match(raw)`.
3. Первое устройство, у которого `match` вернул `true`, получает право форматировать сообщение.
4. Для нашего примера с полем `robonomics_address` это будет `AltruistDevice`.

## 3. Device-форматтер обрабатывает payload

**Модуль:** `src/devices/altruist/altruist.module.ts`
**Класс:** `AltruistDevice`
**Файл:** `src/devices/altruist/altruist.device.ts`
**Методы:** `match(raw)`, `format(raw)`

Что происходит:

1. `match(raw)` проверяет, что payload содержит непустое поле `robonomics_address`.
2. `format(raw)` вызывает `assertValid(payload)`:
   - проверяет наличие обязательных полей;
   - проверяет типы (`robonomics_address`, `owner`, `signature`, `sensordatavalues`, `GPS_lat`, `GPS_lon`);
   - проверяет, что `signature` — hex без `0x`.
3. Затем вызывается `assertSignature(input)`:
   - сервис `AltruistSignatureVerifier.verify(...)` проверяет ED25519-подпись.
4. После успешной проверки `buildMeasurement(...)` парсит `sensordatavalues` и формирует `AltruistMeasurement`:
   - конвертирует давление `p` из Pa в мм рт. ст.;
   - маппит ключи (`t` → `temperature`, `p1` → `pm10` и т.д.).
5. Результат `format`:
   ```json
   {
     "4H1...": {
       "model": 2,
       "geo": "55.75,37.61",
       "donated_by": "owner-name",
       "signature": "a1b2c3...",
       "measurement": {
         "timestamp": 1715616000,
         "temperature": 23.4,
         "pressure": 759.99,
         "humidity": 55,
         "pm10": 10,
         "pm25": 5,
         "CO": 0.3
       }
     }
   }
   ```

## 4. Pipeline формирует обработанную запись

**Модуль:** `src/core/pipeline/pipeline.module.ts`
**Класс:** `PipelineService`
**Файл:** `src/core/pipeline/pipeline.service.ts`
**Метод:** `ingest(raw)`

Что происходит:

1. После `device.format(raw)` `PipelineService` собирает `ProcessedSensorReading`:
   ```ts
   {
     id: randomUUID(),
     station: 'http',
     device: 'altruist',
     rawPayload: body,
     formattedPayload: altruistOutput,
     receivedAt: raw.receivedAt,
     processedAt: new Date()
   }
   ```
2. Если `formattedPayload` не `null`, эмитится событие:
   ```ts
   events.emit('sensor.reading.processed', reading)
   ```
3. Это событие получают все подписанные фидеры (`PubsubFeederService`, `DatalogFeederService`).
4. Метод возвращает `ProcessedSensorReading` в `HttpStationController`, который отвечает клиенту `200 OK`.

## 5. Фидеры получают событие и публикуют данные

### 5.1 PubsubFeeder

**Модуль:** `src/feeders/pubsub/pubsub-feeder.module.ts`
**Класс:** `PubsubFeederService`
**Файл:** `src/feeders/pubsub/pubsub-feeder.service.ts`
**Метод:** `onReadingProcessed(reading)` → `publish(reading)`

Что происходит:

1. Метод, помеченный `@OnEvent(SensorEvents.ReadingProcessed)`, принимает `ProcessedSensorReading`.
2. Если IPFS-нода подключена (`this.connected === true`), `formattedPayload` сериализуется в JSON и публикуется в топик pubsub через `client.pubsub.publish(topic, data)`.
3. Если нода недоступна — сообщение пропускается, а фоновый поллер периодически пытается восстановить соединение.

### 5.2 DatalogFeeder

**Модуль:** `src/feeders/datalog/datalog-feeder.module.ts`
**Класс:** `DatalogFeederService`
**Файл:** `src/feeders/datalog/datalog-feeder.service.ts`
**Методы:** `onReadingProcessed(reading)` → `publish(reading)` → `flush()`

Что происходит:

1. `publish(reading)` добавляет `formattedPayload` во внутренний буфер в памяти.
2. Таймер, запущенный в `onModuleInit()`, периодически вызывает `flush()`.
3. `flush()`:
   - забирает текущий буфер;
   - вызывает `buildAggregatedPayload(batch)`;
   - группирует записи по `robonomics_address`;
   - собирает все `measurement` в массив `measurements`, отсортированный по `timestamp`;
   - записывает агрегированный payload во временный JSON-файл.
4. Вызывается `IpfsUploaderRegistry.uploadAll(filePath)` — параллельная загрузка во все включённые IPFS-аплоадеры.
5. Если загрузка успешна, эмитится событие:
   ```ts
   events.emit('storage.ipfs.uploaded', { cid, uploaders })
   ```
6. Временный файл удаляется в `finally`.

## 6. IPFS-аплоадеры загружают файл

**Модуль:** `src/ipfs-uploaders/ipfs-uploaders.module.ts`
**Класс:** `IpfsUploaderRegistry`
**Файл:** `src/ipfs-uploaders/ipfs-uploader-registry.service.ts`
**Метод:** `uploadAll(filePath): Promise<IpfsUploadOutcome>`

Что происходит:

1. `uploadAll` параллельно вызывает `upload(filePath)` у всех зарегистрированных аплоадеров (`LocalIpfsUploaderService`, `PinataUploaderService` и др.).
2. Успешные CID собираются; первый успешный CID становится каноническим.
3. Возвращается `{ cid, uploaders }`, где `uploaders` — список имён, вернувших канонический CID.

## 7. Robonomics datalog анкорит CID on-chain

**Модуль:** `src/feeders/datalog/robonomics/robonomics-datalog.module.ts` (дочерний для DatalogFeeder)
**Класс:** `RobonomicsDatalogService`
**Файл:** `src/feeders/datalog/robonomics/robonomics-datalog.service.ts`
**Метод:** `onIpfsUploaded(payload)` → `submitOne(record)`

Что происходит:

1. Метод, помеченный `@OnEvent(StorageEvents.IpfsUploaded)`, получает `{ cid, uploaders }`.
2. `DatalogRecordService.enqueue(cid)` сохраняет CID в базу со статусом `NEW` (если такого CID ещё нет).
3. Если запись `NEW`, вызывается `submitOne(record)`.
4. `submitOne` вызывает `RobonomicsChainService.submit(cid)`.
5. `RobonomicsChainService`:
   - лениво создаёт WS-подключение через `ApiPromise.create`;
   - лениво создаёт Keyring-пару из `ROBONOMICS_MNEMONIC`;
   - строит экстринсик `api.tx.datalog.record(cid)`;
   - при необходимости оборачивает его в `rws.call(owner, call)`;
   - подписывает и отправляет через `signAndSend`;
   - ждёт `isFinalized` или таймаута.
6. При успехе `DatalogRecordService.markDone(id)` обновляет статус на `DONE`.
7. При неудаче `DatalogRecordService.markFailure(id, error)` увеличивает `attempts` и сохраняет ошибку; запись остаётся `NEW`.
8. Параллельно фоновый таймер раз в `ROBONOMICS_RETRY_MS` вызывает `processQueue()`, который серийно обрабатывает все `NEW` записи.

## 8. Ответ HTTP-станции

**Модуль:** `src/stations/http/http-station.module.ts`
**Класс:** `HttpStationController`
**Файл:** `src/stations/http/http-station.controller.ts`
**Метод:** `ingest(...)`

Что происходит:

1. `PipelineService.ingest(...)` возвращает `ProcessedSensorReading`.
2. Контроллер возвращает её клиенту со статусом `200 OK`.
3. Ответ подтверждает только завершение локальной проверки и форматирования.
4. Фидеры и datalog продолжают работу асинхронно уже после ответа клиенту; их доставка ответом не подтверждается.

## Сводная таблица пути

| Этап | Модуль | Класс | Метод | Результат |
|------|--------|-------|-------|-----------|
| Приём HTTP | `src/stations/http/` | `HttpStationController` | `ingest()` | `RawSensorReading` |
| Pipeline | `src/core/pipeline/` | `PipelineService` | `ingest()` | `Device` + `ProcessedSensorReading` |
| Реестр устройств | `src/devices/` | `DeviceRegistry` | `find()` | подходящий `Device` |
| Форматтер | `src/devices/altruist/` | `AltruistDevice` | `format()` | `AltruistOutput` |
| Проверка подписи | `src/devices/altruist/` | `AltruistSignatureVerifier` | `verify()` | `boolean` |
| Событие данных | `src/core/pipeline/` | `PipelineService` | `events.emit()` | `sensor.reading.processed` |
| Pubsub | `src/feeders/pubsub/` | `PubsubFeederService` | `publish()` | публикация в IPFS pubsub |
| Datalog | `src/feeders/datalog/` | `DatalogFeederService` | `flush()` | файл + `storage.ipfs.uploaded` |
| IPFS upload | `src/ipfs-uploaders/` | `IpfsUploaderRegistry` | `uploadAll()` | `{ cid, uploaders }` |
| Robonomics | `src/feeders/datalog/robonomics/` | `RobonomicsDatalogService` | `onIpfsUploaded()` | запись в БД + экстринсик |
| Chain client | `src/feeders/datalog/robonomics/` | `RobonomicsChainService` | `submit()` | txHash или ошибка |
| Queue | `src/feeders/datalog/robonomics/` | `DatalogRecordService` | `enqueue/markDone/markFailure` | статус `NEW`/`DONE` |

## Важные замечания

- `ProcessedSensorReading` не сохраняется в базу данных; он существует только в памяти и в событии.
- Единственная таблица в базе — `datalog_records`; она нужна для очереди отправки CID в Robonomics.
- Если `AltruistDevice` не принимает payload (нет `robonomics_address`), `formattedPayload` будет `null` и событие не эмитится.
- Если `FEEDER_DATALOG_ENABLED=false`, то `DatalogFeederService` и весь его дочерний `RobonomicsDatalogModule` не загружаются.
- Если `ROBONOMICS_DATALOG_ENABLED=false` (но `FEEDER_DATALOG_ENABLED=true`), фидер всё равно загружает файлы в IPFS и логирует CID, но не отправляет их on-chain.
