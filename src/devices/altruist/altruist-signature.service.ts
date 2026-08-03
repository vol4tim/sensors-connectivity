import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Keyring } from '@polkadot/keyring';
import { hexToU8a } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';

/**
 * Проверяет ED25519-подпись Altruist по robonomics_address (SS58).
 *
 * Алгоритм согласован со стороной, подписывающей сообщение:
 *   message = `${sensordatavalues},time:${time}`
 *   time    = Date.now().toString().slice(0, -5)   // ~100-секундный bucket
 *
 * cryptoWaitReady() инициализирует WASM-крипту разово на старте — все
 * последующие verify-вызовы синхронные.
 */
@Injectable()
export class AltruistSignatureVerifier implements OnModuleInit {
  private readonly logger = new Logger(AltruistSignatureVerifier.name);

  /**
   * Инициализирует WASM-криптографию Polkadot. Вызывается NestJS при старте модуля.
   *
   * @returns {Promise<void>}
   */
  async onModuleInit(): Promise<void> {
    await cryptoWaitReady();
  }

  /**
   * Проверяет ED25519-подпись сообщения из sensordatavalues по SS58-адресу подписанта.
   *
   * @param {string} sensordatavalues - Строка из payload, как пришла от устройства.
   * @param {string} signatureHex - Hex-подпись без префикса 0x.
   * @param {string} robonomicsAddress - SS58-адрес ED25519-ключа подписанта.
   * @returns {boolean} - true, если подпись валидна; иначе false.
   */
  verify(sensordatavalues: string, signatureHex: string, robonomicsAddress: string): boolean {
    const message = this.buildMessage(sensordatavalues);

    try {
      const keyring = new Keyring({ type: 'ed25519' });
      const pair = keyring.addFromAddress(robonomicsAddress);
      return pair.verify(message, hexToU8a(`0x${signatureHex}`), pair.publicKey);
    } catch (e) {
      this.logger.warn(
        `Altruist signature verify threw: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  /**
   * Собирает подписываемое сообщение, добавляя time-bucket (~100 секунд) из текущего времени.
   *
   * @param {string} sensordatavalues - Исходная строка sensordatavalues.
   * @returns {string} - Готовое к проверке подписи сообщение.
   */
  private buildMessage(sensordatavalues: string): string {
    const time = Date.now().toString().slice(0, -5);
    return `${sensordatavalues},time:${time}`;
  }
}
