import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    Res,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe
} from '@nestjs/common';
import { Response } from 'express';
import { InterestService } from './interest.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CalculateInterestDto } from './dto/calculate-interest.dto';

@Controller('accounts')
export class InterestController {
    constructor(private readonly interestService: InterestService) { }

    @Post('create-account')
    async createNewAccount(
        @Body() createAccountDto: CreateAccountDto,
        @Res() res: Response
    ): Promise<void> {
        const result = await this.interestService.createAccount(createAccountDto);
        res.status(HttpStatus.CREATED).json(result);
    }

    @Get(':id')
    async getAccountById(@Param('id') id: string, @Res() res: Response): Promise<void> {
        const result = await this.interestService.getAccountDetails(id);
        res.status(HttpStatus.OK).json(result);
    }

    @Post(':id/calculate-interest')
    async calculateInterest(
        @Param('id') id: string,
        @Body() calculateInterestDto: CalculateInterestDto,
        @Res() res: Response
    ): Promise<void> {
        const date = calculateInterestDto.date ? new Date(calculateInterestDto.date) : new Date();
        const result = await this.interestService.calculateDailyInterest(id, date);

        res.status(result.isNew ? HttpStatus.CREATED : HttpStatus.OK).json(result);
    }

    @Get(':id/interest-history')
    async getAccountInterestHistory(
        @Param('id') id: string,
        @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
        @Res() res: Response
    ): Promise<void> {
        const result = await this.interestService.getInterestHistory(id, limit);
        res.status(HttpStatus.OK).json(result);
    }
}
