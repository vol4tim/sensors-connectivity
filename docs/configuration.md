# Конфигурация

Все настройки сервиса задаются через переменные окружения. В проекте используется `@nestjs/config` без сторонних библиотек валидации (Joi отсутствует намеренно). Загрузчики конфигурации — синхронные функции `loadXxxConfig(env)`, которые вызываются на этапе композиции модулей.

## Конвенция модулей

Каждый новый station/feeder/module обязан следовать шаблону:

1. **Файл конфигурации** рядом с модулем (`<name>-<station|feeder|uploader>.config.ts`):
   - DI-токен: `export const <NAME>_<TYPE>_CONFIG = '<NAME>_<TYPE>_CONFIG' as const`.
   - Интерфейс: `<Name><Type>Config { enabled: boolean; ... }`.
   - Загрузчик: `export function load<Name><Type>Config(env = process.env)`.
2. **Модуль как DynamicModule** со статическим `register(config)`.
3. **Агрегатор** (`StationsModule`, `FeedersModule`, `IpfsUploadersModule`, `RobonomicsDatalogModule`) подключает модуль только если `cfg.enabled === true`.
4. Переменные окружения добавляются в `.env.example` в соответствующий раздел.

## Глобальные настройки

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `NODE_ENV` | `development` | Окружение выполнения. |
| `APP_PORT` | `3000` | Порт HTTP-сервера. |
| `SWAGGER_ENABLED` | `true` | Включить Swagger UI (`false` — выключить). |
| `SWAGGER_PATH` | `docs` | Путь к Swagger UI. |

## База данных

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DB_PATH` | `./data/sensors-connectivity.sqlite` | Путь к файлу SQLite. |
| `DB_SYNCHRONIZE` | `false` | Автосинхронизация схемы TypeORM. Включать только для локальной разработки. |
| `DB_LOGGING` | `false` | Логирование SQL-запросов. |

## Станции (Stations)

### HTTPStation

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `STATION_HTTP_ENABLED` | `true` | Включить HTTP REST API. |

## Фидеры (Feeders)

### PubsubFeeder

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `FEEDER_PUBSUB_ENABLED` | `true` | Включить публикацию в IPFS pubsub. |
| `FEEDER_PUBSUB_API_URL` | `http://127.0.0.1:5001` | RPC API URL локальной Kubo-ноды. Может быть http-URL или multiaddr. |
| `FEEDER_PUBSUB_TOPIC` | `mytop` | Топик pubsub. |
| `FEEDER_PUBSUB_RETRY_MS` | `15000` | Интервал повторной проверки коннекта, когда нода недоступна. |

### DatalogFeeder

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `FEEDER_DATALOG_ENABLED` | `true` | Включить накопление сообщений и flush в IPFS. |
| `FEEDER_DATALOG_FLUSH_MS` | `60000` | Период flush'а буфера в миллисекундах. |

## IPFS-аплоадеры

### Local IPFS uploader

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `IPFS_LOCAL_ENABLED` | `true` | Включить загрузку в локальную Kubo-ноду. |
| `IPFS_LOCAL_API_URL` | `http://127.0.0.1:5001` | RPC API URL ноды. |

### Pinata uploader

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `IPFS_PINATA_ENABLED` | `false` | Включить загрузку в Pinata (требует JWT). |
| `IPFS_PINATA_JWT` | — | JWT с правами `pinFileToIPFS`. |
| `IPFS_PINATA_API_URL` | `https://api.pinata.cloud` | База API Pinata. |

## Robonomics datalog

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `ROBONOMICS_DATALOG_ENABLED` | `false` | Включить отправку CID в datalog Robonomics. |
| `ROBONOMICS_WS_ENDPOINT` | `wss://kusama.rpc.robonomics.network/` | WebSocket RPC-эндпоинт парачейна. |
| `ROBONOMICS_MNEMONIC` | — | Мнемоника/SURI подписывающего аккаунта. |
| `ROBONOMICS_KEYPAIR_TYPE` | `sr25519` | Тип ключевой пары: `ed25519`, `sr25519`, `ecdsa`, `ethereum`. |
| `ROBONOMICS_SS58_FORMAT` | `32` | Префикс SS58 для адресов. |
| `ROBONOMICS_RWS_SUBSCRIPTION_OWNER` | — | Адрес владельца RWS-подписки. Если задан и подписка активна — экстринсики идут через `rws.call`. |
| `ROBONOMICS_RETRY_MS` | `60000` | Период фонового ретрая записей со статусом `NEW`. |
| `ROBONOMICS_BATCH_SIZE` | `20` | Количество `NEW` записей за один retry-проход. |
| `ROBONOMICS_SUBMIT_TIMEOUT_MS` | `300000` | Таймаут ожидания finalize экстринсика. |

## Логика флагов `enabled`

- Модули, включённые по умолчанию: `env.XXX_ENABLED !== 'false'` (HTTP, pubsub, datalog, local IPFS).
- Модули, требующие явного opt-in: `env.XXX_ENABLED === 'true'` (Pinata, Robonomics datalog).
