# Robonomics datalog

Модуль анкорит CID, полученные от `DatalogFeeder`, в datalog-палету парачейна Robonomics.

> RobonomicsDatalogModule — дочерний модуль `DatalogFeeder`. Он располагается внутри директории фидера (`src/feeders/datalog/robonomics/`) и включается **только если включён сам DatalogFeeder** и `ROBONOMICS_DATALOG_ENABLED=true`.

Файлы:

- `src/feeders/datalog/robonomics/robonomics-datalog.service.ts` — оркестратор очереди.
- `src/feeders/datalog/robonomics/robonomics-chain.service.ts` — тонкий клиент Polkadot.
- `src/feeders/datalog/robonomics/datalog-record.service.ts` — сервис очереди.
- `src/feeders/datalog/robonomics/robonomics-datalog.config.ts` — конфигурация.
- `src/feeders/datalog/robonomics/robonomics-datalog.module.ts` — модуль.
- `src/feeders/datalog/robonomics/entities/datalog-record.entity.ts` — сущность очереди.

## Включение

Для работы модуля необходимы одновременно:

```env
FEEDER_DATALOG_ENABLED=true
ROBONOMICS_DATALOG_ENABLED=true
ROBONOMICS_WS_ENDPOINT=ws://127.0.0.1:9944
ROBONOMICS_MNEMONIC=//Alice
ROBONOMICS_KEYPAIR_TYPE=sr25519
ROBONOMICS_SS58_FORMAT=32
```

Если `FEEDER_DATALOG_ENABLED=false`, модуль не загружается — `RobonomicsDatalogModule` подключается как `imports` внутри `DatalogFeederModule.register()`, который вызывается только при включённом фидере.

## Поток

```
StorageEvents.IpfsUploaded { cid, uploaders }
    │
    ▼
RobonomicsDatalogService.onIpfsUploaded()
    → DatalogRecordService.enqueue(cid) // upsert по unique cid → NEW
    → submitOne(record)                 // сразу
    │
    ▼
RobonomicsChainService.submit(cid)
    → ленивый WS-коннект (ApiPromise.create)
    → ленивый Keyring-подписант из mnemonic
    → api.tx.datalog.record(cid).signAndSend(account, cb)
    → ждёт isFinalized
    │
  ┌─┴─┐
  OK  fail
  │   │
  ▼   ▼
 markDone  markFailure (attempts++, lastError) → запись остаётся NEW
```

Параллельно работает фоновый таймер раз в `ROBONOMICS_RETRY_MS`, который выбирает записи со статусом `NEW` и серийно пытается отправить их повторно.

## RWS-подписка

Если задан `ROBONOMICS_RWS_SUBSCRIPTION_OWNER`, перед отправкой проверяется активность подписки:

```ts
const data = api.query.rws.ledger(owner);
```

- Подписка `Lifetime` — активна всегда.
- Подписка `Daily` — активна, пока `Date.now() <= issueTime + days * 24 * 60 * 60 * 1000`.
- Если подписка активна — экстринсик оборачивается в `rws.call(owner, call)`.
- Иначе — отправляется напрямую.

## Сущность `DatalogRecordEntity`

Таблица `datalog_records`:

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ. |
| `cid` | varchar(128), unique | IPFS-хеш. |
| `status` | varchar(16) | `NEW` или `DONE`. |
| `attempts` | integer | Счётчик попыток отправки. |
| `lastError` | text, nullable | Последняя ошибка. |
| `createdAt` | datetime | Время создания. |
| `updatedAt` | datetime | Время обновления. |

Неудачные отправки не меняют статус на отдельный `FAILED`, а остаются `NEW` с увеличенным `attempts` и сохранённой ошибкой.

## Настройки

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `ROBONOMICS_DATALOG_ENABLED` | `false` | Включить модуль. |
| `ROBONOMICS_WS_ENDPOINT` | `wss://kusama.rpc.robonomics.network/` | WS RPC. |
| `ROBONOMICS_MNEMONIC` | — | Мнемоника подписанта. |
| `ROBONOMICS_KEYPAIR_TYPE` | `sr25519` | Тип ключевой пары. |
| `ROBONOMICS_SS58_FORMAT` | `32` | SS58-префикс. |
| `ROBONOMICS_RWS_SUBSCRIPTION_OWNER` | — | Владелец RWS-подписки. |
| `ROBONOMICS_RETRY_MS` | `60000` | Период ретрая. |
| `ROBONOMICS_BATCH_SIZE` | `20` | Размер batch'а ретрая. |
| `ROBONOMICS_SUBMIT_TIMEOUT_MS` | `300000` | Таймаут finalize. |
