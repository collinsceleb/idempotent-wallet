import { Module } from '@nestjs/common';
import { WalletModule } from './modules/wallet/wallet.module';
import { InterestModule } from './modules/interest/interest.module';
import { AppController } from './app.controller';

@Module({
    imports: [WalletModule, InterestModule],
    controllers: [AppController],
    providers: [],
})
export class AppModule {
}
