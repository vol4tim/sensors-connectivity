import { DynamicModule, Module, Type } from '@nestjs/common';
import { IpfsUploaderRegistry } from './ipfs-uploader-registry.service';
import { IpfsUploader } from './ipfs-uploader.base';
import { loadLocalIpfsUploaderConfig } from './local/local-ipfs-uploader.config';
import { LocalIpfsUploaderModule } from './local/local-ipfs-uploader.module';
import { LocalIpfsUploaderService } from './local/local-ipfs-uploader.service';
import { loadPinataUploaderConfig } from './pinata/pinata-uploader.config';
import { PinataUploaderModule } from './pinata/pinata-uploader.module';
import { PinataUploaderService } from './pinata/pinata-uploader.service';

/**
 * Aggregator всех IPFS-аплоадеров.
 *
 * registerFromEnv() читает env, подключает только включённые модули и собирает
 * IpfsUploaderRegistry factory-провайдером. global: true — реестр доступен
 * любому фидеру без явного импорта модуля.
 *
 * Добавление нового аплоадера (Crust, ...):
 *   1. Создать <name>/<name>-uploader.{config,service,module}.ts по шаблону local/pinata.
 *   2. Импортировать и добавить блок ниже (loadXxxConfig → push в factories).
 *   3. Описать переменные в .env.example.
 */
@Module({})
export class IpfsUploadersModule {
  /**
   * Собирает глобальный реестр IPFS-аплоадеров из env.
   *
   * @param {NodeJS.ProcessEnv} env - Объект переменных окружения (по умолчанию process.env).
   * @returns {DynamicModule} - Модуль с IpfsUploaderRegistry в качестве провайдера.
   */
  static registerFromEnv(env: NodeJS.ProcessEnv = process.env): DynamicModule {
    const factories: Array<{ module: DynamicModule; token: Type<IpfsUploader> }> = [];

    const localCfg = loadLocalIpfsUploaderConfig(env);
    if (localCfg.enabled) {
      factories.push({
        module: LocalIpfsUploaderModule.register(localCfg),
        token: LocalIpfsUploaderService,
      });
    }

    const pinataCfg = loadPinataUploaderConfig(env);
    if (pinataCfg.enabled) {
      factories.push({
        module: PinataUploaderModule.register(pinataCfg),
        token: PinataUploaderService,
      });
    }

    return {
      global: true,
      module: IpfsUploadersModule,
      imports: factories.map((f) => f.module),
      providers: [
        {
          provide: IpfsUploaderRegistry,
          inject: factories.map((f) => f.token),
          useFactory: (...uploaders: IpfsUploader[]) => new IpfsUploaderRegistry(uploaders),
        },
      ],
      exports: [IpfsUploaderRegistry],
    };
  }
}
