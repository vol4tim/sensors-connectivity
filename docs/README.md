# Документация sensors-connectivity

Этот раздел содержит техническую документацию сервиса **sensors-connectivity** — NestJS-приложения для приёма, обработки и передачи сенсорных данных.

## Структура документации

| Файл | Содержание |
|------|------------|
| [`architecture.md`](./architecture.md) | Архитектура, поток данных, доменная терминология |
| [`data-flow.md`](./data-flow.md) | Пошаговый путь входящего сообщения через приложение |
| [`configuration.md`](./configuration.md) | Переменные окружения, конфигурация модулей, DI-токены |
| [`api.md`](./api.md) | REST API, эндпоинты, форматы запросов и ответов |
| [`devices.md`](./devices.md) | Устройства-форматтеры (Device), текущий `AltruistDevice` |
| [`feeders.md`](./feeders.md) | Фидеры вывода: PubsubFeeder, DatalogFeeder, IPFS-аплоадеры |
| [`robonomics-datalog.md`](./robonomics-datalog.md) | Отправка CID в datalog парачейна Robonomics |
| [`database.md`](./database.md) | База данных SQLite, сущности, миграции |
| [`development.md`](./development.md) | Запуск, тесты, линтинг, типичные команды |

## Быстрый старт

```bash
cp .env.example .env
mkdir -p data
npm install
npm run start:dev
```

- Приём данных: `POST http://localhost:3000/`
- Swagger: `http://localhost:3000/docs`
- Health: `GET /health`

Полное описание переменных окружения и потока данных см. в соответствующих разделах.
