import { Module } from '@nestjs/common';
import { AccountController } from './controllers/account.controller';
import { InterestService } from './services/interest.service';

@Module({
    controllers: [AccountController],
    providers: [InterestService],
    exports: [InterestService],
})
export class InterestModule { }
