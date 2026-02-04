import { Module } from '@nestjs/common';
import { AccountController } from './interest.controller';
import { InterestService } from './interest.service';

@Module({
    controllers: [AccountController],
    providers: [InterestService],
    exports: [InterestService],
})
export class InterestModule { }
