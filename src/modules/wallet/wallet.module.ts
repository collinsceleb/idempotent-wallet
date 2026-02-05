import { Module } from '@nestjs/common';
import { TransferController } from './wallet.controller';
import { TransferService } from './wallet.service';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
    imports: [RedisModule],
    controllers: [TransferController],
    providers: [TransferService],
    exports: [TransferService],
})
export class WalletModule { }
