# База данных

Сервис использует SQLite через драйвер `better-sqlite3` и TypeORM.

## Конфигурация TypeORM

Runtime конфигурация находится в `src/database/database.module.ts`:

```ts
TypeOrmModule.forRootAsync({
  useFactory: (db) => ({
    type: 'better-sqlite3',
    database: db.path,
    synchronize: db.synchronize,
    logging: db.logging,
    autoLoadEntities: true,
  }),
});
```

Для CLI миграций используется standalone `DataSource` в `src/database/typeorm.datasource.ts`.

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DB_PATH` | `./data/sensors-connectivity.sqlite` | Путь к файлу БД. |
| `DB_SYNCHRONIZE` | `false` | Автосинхронизация схемы. Включать только для локальной разработки. |
| `DB_LOGGING` | `false` | Логирование SQL-запросов. |

## Сущности

### `DatalogRecordEntity`

Таблица `datalog_records`:

```ts
@Entity({ name: 'datalog_records' })
class DatalogRecordEntity {
  id: string;           // UUID, PK
  cid: string;          // varchar(128), unique index
  status: 'NEW' | 'DONE';
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Является единственной сущностью в проекте. Используется исключительно для очереди отправки CID в Robonomics datalog. Обработанные sensor readings не сохраняются.

## Миграции

Для продакшена используются миграции:

```bash
# Сгенерировать миграцию
npm run migration:generate -- src/database/migrations/InitialSchema

# Применить
npm run migration:run

# Откатить
npm run migration:revert
```

При локальной разработке достаточно `DB_SYNCHRONIZE=true`. Если схема находится в противоречивом состоянии (например, после переименования колонок), удалите файлы `data/sensors-connectivity.sqlite*` и перезапустите приложение.
