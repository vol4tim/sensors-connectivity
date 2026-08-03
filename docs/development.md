# Разработка

## Подготовка окружения

Требования:

- Node.js `>=20.11`
- npm

Установка зависимостей:

```bash
npm install
```

## Запуск

### Локальная разработка

```bash
cp .env.example .env
mkdir -p data
npm run start:dev
```

- Приём данных: `POST http://localhost:3000/`
- Swagger: `http://localhost:3000/docs`
- Health: `GET /health`

### Продакшен

```bash
npm run build
npm run start:prod
```

## Скрипты npm

| Скрипт | Описание |
|--------|----------|
| `npm run start:dev` | Запуск с hot reload. |
| `npm run build` | Сборка в `dist/`. |
| `npm run start:prod` | Запуск собранного приложения. |
| `npm run lint` | ESLint с автофиксом. |
| `npm run format` | Prettier форматирование. |
| `npm test` | Юнит-тесты Jest. |
| `npm test -- <pattern>` | Запуск конкретного теста. |
| `npm run test:e2e` | E2E-тесты. |
| `npm run migration:generate -- src/database/migrations/<Name>` | Генерация миграции. |
| `npm run migration:run` | Применение миграций. |
| `npm run migration:revert` | Откат последней миграции. |

## Структура проекта

```
src/
├── app.module.ts
├── main.ts
├── common/          # events, interfaces, DTO, базовые классы
├── config/          # registerAs-конфиги
├── core/            # PipelineService
├── database/        # TypeORM
├── devices/         # Device-форматтеры (Altruist)
├── feeders/         # PubsubFeeder, DatalogFeeder, RobonomicsDatalog (под DatalogFeeder)
├── health/          # Health check
├── ipfs-uploaders/  # Local, Pinata, реестр
└── stations/        # HTTPStation
```

## Добавление новой станции

1. Создайте директорию `src/stations/<name>/`.
2. Добавьте `<name>-station.config.ts` с интерфейсом, токеном и загрузчиком.
3. Добавьте `<name>-station.module.ts` как `DynamicModule` с `register(config)`.
4. Реализуйте контроллер/сервис, который пушит `RawSensorReading` в `PipelineService.ingest()`.
5. Подключите модуль в `StationsModule.registerFromEnv()`.
6. Добавьте переменные в `.env.example`.

## Добавление нового фидера

Аналогично станции, но директория `src/feeders/<name>/`, сервис подписывается на `SensorEvents.ReadingProcessed` через `@OnEvent`.

## Линтинг и форматирование

ESLint конфигурация в `eslint.config.mjs`, Prettier в `.prettierrc`.

```bash
npm run lint
npm run format
```

## Замечания

- Юнит- и E2E-тесты в проекте пока не реализованы.
- При изменении доменных интерфейсов обновляйте соответствующие разделы документации в `docs/`.
