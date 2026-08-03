import { Injectable, Logger } from '@nestjs/common';
import { IpfsUploader } from './ipfs-uploader.base';

export interface IpfsUploadOutcome {
  /** Канонический CID файла; null если ни один аплоадер не справился. */
  cid: string | null;
  /** Имена аплоадеров, успешно вернувших этот CID. */
  uploaders: string[];
}

/**
 * Реестр всех включённых IPFS-аплоадеров.
 *
 * IPFS контентно-адресуемый — один и тот же файл даёт один и тот же CID,
 * поэтому uploadAll() возвращает один cid + список имён успешных аплоадеров.
 * Ошибки и редкое расхождение CIDов (например CIDv0 vs v1 у разных клиентов)
 * логируются здесь, наверх не пробрасываются.
 */
@Injectable()
export class IpfsUploaderRegistry {
  private readonly logger = new Logger(IpfsUploaderRegistry.name);

  /**
   * @param {IpfsUploader[]} uploaders - Массив включённых IPFS-аплоадеров.
   */
  constructor(private readonly uploaders: IpfsUploader[]) {
    this.logger.log(
      `Registered IPFS uploaders: ${
        uploaders.length === 0 ? '(none)' : uploaders.map((u) => u.name).join(', ')
      }`,
    );
  }

  /** Возвращает количество зарегистрированных аплоадеров. */
  get count(): number {
    return this.uploaders.length;
  }

  /**
   * Параллельно загружает файл всеми аплоадерами и возвращает канонический CID.
   *
   * @param {string} filePath - Абсолютный путь к временному файлу.
   * @returns {Promise<IpfsUploadOutcome>} - Результат загрузки с CID и списком успешных аплоадеров.
   */
  async uploadAll(filePath: string): Promise<IpfsUploadOutcome> {
    if (this.uploaders.length === 0) {
      return { cid: null, uploaders: [] };
    }

    type Result = { name: string; cid: string | null };
    const results: Result[] = await Promise.all(
      this.uploaders.map(async (u): Promise<Result> => {
        try {
          return { name: u.name, cid: await u.upload(filePath) };
        } catch (e) {
          this.logger.error(
            `[${u.name}] upload failed: ${e instanceof Error ? e.message : String(e)}`,
          );
          return { name: u.name, cid: null };
        }
      }),
    );

    const successes = results.filter((r): r is { name: string; cid: string } => r.cid !== null);
    if (successes.length === 0) {
      return { cid: null, uploaders: [] };
    }

    const canonical = successes[0].cid;
    const divergent = successes.filter((s) => s.cid !== canonical);
    if (divergent.length > 0) {
      this.logger.warn(
        `IPFS uploaders returned divergent CIDs (using ${canonical}): ${divergent
          .map((d) => `${d.name}=${d.cid}`)
          .join(', ')}`,
      );
    }

    return {
      cid: canonical,
      uploaders: successes.filter((s) => s.cid === canonical).map((s) => s.name),
    };
  }
}
