/**
 * Парсер строки `sensordatavalues` из протокола Altruist:
 *   "nm:0.00,na:0.00,t:23.4,p:101325,h:55,p1:10,p2:5,co1:0.3"
 *
 * Возвращает map ключ → числовое значение. Невалидные пары пропускаются.
 */
/**
 * Парсит строку `sensordatavalues` из протокола Altruist.
 *
 * Зашифрованные значения передаются в виде "e.<base64(IV+ciphertext)>" и
 * возвращаются как строки без изменений. Остальные значения преобразуются в числа.
 * Невалидные пары пропускаются.
 *
 * @param {string} raw - Исходная строка вида "key1:val1,key2:val2,...".
 * @returns {Record<string, number | string>} - Map ключ → числовое или зашифрованное строковое значение.
 */
export function parseSensorDataValues(raw: string): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  if (!raw) return result;

  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const rawValue = pair.slice(idx + 1).trim();
    if (!key || !rawValue) continue;

    if (rawValue.startsWith('e.')) {
      result[key] = rawValue;
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    result[key] = value;
  }

  return result;
}
