import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DatalogRecordStatus = 'NEW' | 'DONE';

/**
 * Запись очереди отправки CID в Robonomics datalog.
 *   NEW  — ещё не подтверждена on-chain, ждёт submit/ретрая;
 *   DONE — extrinsic finalize'нулся успешно.
 *
 * Failed-submit'ы не выделяются в отдельный статус: запись остаётся NEW,
 * увеличивается `attempts`, последняя ошибка пишется в `lastError`.
 */
@Entity({ name: 'datalog_records' })
export class DatalogRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  cid!: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'NEW' })
  status!: DatalogRecordStatus;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
