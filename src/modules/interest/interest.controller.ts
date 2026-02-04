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

    /**
     * POST /accounts
     * Create a new account with optional initial balance
     */
    @Post()
    async createNewAccount(
        @Body() createAccountDto: CreateAccountDto,
        @Res() res: Response
    ): Promise<void> {
        const account = await this.interestService.createAccount(createAccountDto);

        res.status(HttpStatus.CREATED).json({
            success: true,
            data: {
                id: account.id,
                balance: account.balance,
                createdAt: account.createdAt,
            },
        });
    }

    /**
     * GET /accounts/:id
     * Get account details by ID
     */
    @Get(':id')
    async getAccountById(@Param('id') id: string, @Res() res: Response): Promise<void> {
        const account = await this.interestService.getAccountOrThrow(id);

        res.json({
            success: true,
            data: {
                id: account.id,
                balance: account.balance,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
            },
        });
    }

    /**
     * POST /accounts/:id/calculate-interest
     * Calculate daily interest for an account
     */
    @Post(':id/calculate-interest')
    async calculateInterest(
        @Param('id') id: string,
        @Body() calculateInterestDto: CalculateInterestDto,
        @Res() res: Response
    ): Promise<void> {
        const date = calculateInterestDto.date ? new Date(calculateInterestDto.date) : new Date();
        const result = await this.interestService.calculateDailyInterest(id, date);

        res.status(result.isNew ? HttpStatus.CREATED : HttpStatus.OK).json({
            success: true,
            message: result.isNew
                ? 'Interest calculated successfully'
                : 'Interest already calculated for this date (idempotent response)',
            data: result,
        });
    }

    /**
     * GET /accounts/:id/interest-history
     * Get interest calculation history for an account
     */
    @Get(':id/interest-history')
    async getAccountInterestHistory(
        @Param('id') id: string,
        @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
        @Res() res: Response
    ): Promise<void> {
        const history = await this.interestService.getInterestHistory(id, limit);

        res.json({
            success: true,
            data: history.map((log) => ({
                id: log.id,
                calculationDate: log.calculationDate,
                principalBalance: log.principalBalance,
                interestAmount: log.interestAmount,
                annualRate: log.annualRate,
                daysInYear: log.daysInYear,
                newBalance: log.newBalance,
                createdAt: log.createdAt,
            })),
        });
    }
}
