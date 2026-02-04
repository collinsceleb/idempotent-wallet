import { Module } from '@nestjs/common';
import { TransferController } from './wallet.controller';
import { TransferService } from './wallet.service';

@Module({
    controllers: [TransferController],
    providers: [TransferService],
    exports: [TransferService],
})
export class WalletModule { }
