# Device-форматтеры

## Базовый класс `Device`

Файл: `src/common/device.base.ts`

```ts
export abstract class Device {
  abstract readonly type: string;
  abstract match(raw: RawSensorReading): boolean;
  abstract format(raw: RawSensorReading): unknown | Promise<unknown>;
}
```

Жизненный цикл в `PipelineService`:

1. `DeviceRegistry.find(raw)` возвращает первое устройство, у которого `match(raw)` вернул `true`.
2. Вызывается `device.format(raw)` — устройство валидирует payload и преобразует его.
3. Если `format()` бросает `BadRequestException`, исключение поднимается до вызывающего (например, HTTP-контроллера), и клиент получает `400`.

## Реестр устройств

`DeviceRegistry` (`src/devices/device-registry.service.ts`) собирается в `DevicesModule` factory-провайдером. Чтобы добавить новое устройство, нужно:

1. Создать модуль и класс `Device`.
2. Импортировать модуль в `DevicesModule`.
3. Добавить класс устройства в `inject` factory-провайдера.

## `AltruistDevice`

Файлы:

- `src/devices/altruist/altruist.device.ts`
- `src/devices/altruist/altruist.types.ts`
- `src/devices/altruist/altruist-signature.service.ts`
- `src/devices/altruist/sensordatavalues.parser.ts`
- `src/devices/altruist/altruist.module.ts`

### Маршрутизация

`AltruistDevice.match(raw)` возвращает `true`, если `raw.payload` — объект и содержит непустое строковое поле `robonomics_address`.

### Обязательные поля входа

```ts
[
  'robonomics_address',
  'owner',
  'signature',
  'sensordatavalues',
  'GPS_lat',
  'GPS_lon',
]
```

Дополнительные поля: `donated_by`, `software_version`.

### Валидация

- `robonomics_address`, `owner` — строки.
- `signature` — hex-строка без префикса `0x`.
- `sensordatavalues` — строка.
- `GPS_lat`, `GPS_lon` — конечные числа.
- `donated_by` — строка, если присутствует.

### Проверка подписи

`AltruistSignatureVerifier` использует `@polkadot/keyring` с типом `ed25519` и проверяет подпись по сообщению:

```ts
const time = Date.now().toString().slice(0, -5);
const message = `${sensordatavalues},time:${time}`;
```

Подпись должна соответствовать публичному ключу из `robonomics_address` (SS58).

### Парсинг `sensordatavalues`

Формат: `key:value,key:value,...`. Поддерживаемые ключи и маппинг:

| Ключ | Поле в `AltruistMeasurement` | Примечание |
|------|------------------------------|------------|
| `t` | `temperature` | — |
| `p` | `pressure` | Конвертация Pa → мм рт. ст. (деление на 133.322). |
| `h` | `humidity` | — |
| `p1` | `pm10` | — |
| `p2` | `pm25` | — |
| `nm` | `noiseMax` | — |
| `na` | `noiseAvg` | — |
| `gc` | `radiation` | — |
| `co` | `CO2` | — |
| `vc` | `TVOC` | — |
| `co1` | `CO` | — |

### Выходной формат

```ts
{
  "<robonomics_address>": {
    "model": 2,
    "geo": "<lat>,<lon>",
    "donated_by": "...",
    "signature": "<hex>",
    "measurement": {
      "timestamp": 1715616000,
      "pm10": 12.3,
      "pm25": 5.6,
      "temperature": 22.1,
      "humidity": 45,
      "pressure": 760.21
    }
  }
}
```

- `timestamp` — Unix-время в секундах на момент вызова `format()`.
- `pressure` всегда в мм рт. ст.
- `donated_by` включается только если был во входе.
