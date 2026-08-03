# Feeders (выходные адаптеры)

Feeders подписываются на событие `sensor.reading.processed` через декоратор `@OnEvent` и реализуют интерфейс `Feeder`.

## `PubsubFeederService`

Файлы:

- `src/feeders/pubsub/pubsub-feeder.service.ts`
- `src/feeders/pubsub/pubsub-feeder.config.ts`
- `src/feeders/pubsub/pubsub-feeder.module.ts`

Публикует `formattedPayload` в топик IPFS pubsub локальной Kubo-ноды.

### Особенности

- Использует `kubo-rpc-client` через динамический ESM-импорт (обход CJS/ESM interop).
- При старте проверяет коннект (`client.id()` с таймаутом 3 секунды).
- Если нода недоступна:
  - старт приложения не блокируется;
  - запускается фоновый поллер, который раз в `FEEDER_PUBSUB_RETRY_MS` проверяет коннект;
  - при восстановлении публикация возобновляется автоматически.
- Ошибки публикации изолированы внутри сервиса и не влияют на другие фидеры.

## `DatalogFeederService`

Файлы:

- `src/feeders/datalog/datalog-feeder.service.ts`
- `src/feeders/datalog/datalog-feeder.config.ts`
- `src/feeders/datalog/datalog-feeder.module.ts`
- `src/feeders/datalog/robonomics/*` — дочерний модуль Robonomics datalog.

Накапливает `formattedPayload` в памяти в течение `FEEDER_DATALOG_FLUSH_MS`, затем выполняет flush.

### Robonomics datalog как подмодуль

`DatalogFeederModule.register()` внутри себя вызывает `RobonomicsDatalogModule.registerFromEnv()`. Это значит:

- если `FEEDER_DATALOG_ENABLED=false`, модуль Robonomics datalog не загружается вообще;
- если `FEEDER_DATALOG_ENABLED=true`, но `ROBONOMICS_DATALOG_ENABLED=false` — `RobonomicsDatalogModule` возвращает пустой модуль: entity не создаётся, событие `storage.ipfs.uploaded` не обрабатывается, но сам `DatalogFeeder` продолжает загружать файлы в IPFS и логировать CIDы.

### Алгоритм flush

1. Берёт текущий буфер.
2. Группирует записи по top-level ключу `robonomics_address`:
   - все поля, кроме `measurement`, берутся из последнего объекта (last-wins);
   - все блоки `measurement` собираются в массив `measurements` и сортируются по `timestamp` по возрастанию.
3. Сериализует агрегированный payload во временный JSON-файл.
4. Вызывает `IpfsUploaderRegistry.uploadAll(filePath)` параллельно для всех включённых аплоадеров.
5. Если хотя бы один аплоадер успешен — эмитит `storage.ipfs.uploaded` с CID и списком имён аплоадеров.
6. Удаляет временный файл в `finally`.

### Пример агрегированного payload

```json
{
  "4H1...": {
    "model": 2,
    "geo": "55.75,37.61",
    "donated_by": "owner-name",
    "signature": "a1b2c3...",
    "measurements": [
      { "timestamp": 1715616000, "temperature": 22.1, ... },
      { "timestamp": 1715616100, "temperature": 22.3, ... }
    ]
  }
}
```

## IPFS-аплоадеры

### Базовый класс

Файл: `src/ipfs-uploaders/ipfs-uploader.base.ts`

```ts
export abstract class IpfsUploader {
  abstract readonly name: string;
  abstract upload(filePath: string): Promise<string>;
}
```

### Реестр

`IpfsUploaderRegistry` (`src/ipfs-uploaders/ipfs-uploader-registry.service.ts`):

- собирает все включённые аплоадеры;
- `uploadAll(filePath)` запускает загрузки параллельно;
- возвращает один CID и список имён аплоадеров, успешно вернувших этот CID;
- ошибки логируются, но не прерывают работу других аплоадеров;
- если CID'ы различаются (например, CIDv0 vs CIDv1), используется первый успешный CID, расхождения логируются.

### `LocalIpfsUploaderService`

Загружает файл в локальную Kubo-ноду через `client.add(content)`.

### `PinataUploaderService`

Загружает файл в Pinata через `POST /pinning/pinFileToIPFS` с авторизацией `Bearer JWT`.

### Добавление нового аплоадера

Создайте директорию по шаблону `src/ipfs-uploaders/<name>/` с:

- `<name>-uploader.config.ts`
- `<name>-uploader.module.ts`
- `<name>-uploader.service.ts`

Затем добавьте модуль в `IpfsUploadersModule.registerFromEnv()` и переменные в `.env.example`.
