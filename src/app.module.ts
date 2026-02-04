import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletModule } from './modules/wallet/wallet.module';
import { InterestModule } from './modules/interest/interest.module';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import configuration from './common/config/configuration';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
            isGlobal: true,
        }),
        DatabaseModule,
        RedisModule,
        WalletModule,
        InterestModule,
    ],
    controllers: [AppController],
    providers: [],
})
export class AppModule {
}
