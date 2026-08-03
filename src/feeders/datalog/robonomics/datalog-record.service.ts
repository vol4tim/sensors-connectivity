import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatalogRecordEntity } from './entities/datalog-record.entity';

/**
 * Сервис для работы с очередью записей datalog в TypeORM-репозитории.
 */
@Injectable()
export class DatalogRecordService {
  /**
   * @param {Repository<DatalogRecordEntity>} repo - Репозиторий очереди datalog.
   */
  constructor(
    @InjectRepository(DatalogRecordEntity)
    private readonly repo: Repository<DatalogRecordEntity>,
  ) {}

  /**
   * Идемпотентная постановка CID в очередь.
   *
   * @param {string} cid - CID, полученный после загрузки в IPFS.
   * @returns {Promise<DatalogRecordEntity>} - Существующая или новая запись.
   */
  async enqueue(cid: string): Promise<DatalogRecordEntity> {
    const existing = await this.repo.findOne({ where: { cid } });
    if (existing) return existing;
    return this.repo.save(this.repo.create({ cid, status: 'NEW', attempts: 0, lastError: null }));
  }

  /**
   * Возвращает самые старые NEW записи ограниченным пакетом.
   *
   * @param {number} limit - Максимальное количество записей.
   * @returns {Promise<DatalogRecordEntity[]>} - Массив NEW записей.
   */
  async findNew(limit: number): Promise<DatalogRecordEntity[]> {
    return this.repo.find({
      where: { status: 'NEW' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Помечает запись как успешно отправленную.
   *
   * @param {string} id - Идентификатор записи.
   * @returns {Promise<void>}
   */
  async markDone(id: string): Promise<void> {
    await this.repo.update({ id }, { status: 'DONE', lastError: null });
  }

  /**
   * Увеличивает счётчик попыток и сохраняет сообщение об ошибке.
   *
   * @param {string} id - Идентификатор записи.
   * @param {string} error - Текст ошибки.
   * @returns {Promise<void>}
   */
  async markFailure(id: string, error: string): Promise<void> {
    await this.repo.increment({ id }, 'attempts', 1);
    await this.repo.update({ id }, { lastError: error });
  }
}
