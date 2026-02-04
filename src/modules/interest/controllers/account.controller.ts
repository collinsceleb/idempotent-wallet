import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    Res,
    HttpStatus
} from '@nestjs/common';
import { Response } from 'express';
import { InterestService } from '../services/interest.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { CalculateInterestDto } from '../dto/calculate-interest.dto';

@Controller('accounts')
export class AccountController {
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
        try {
            const account = await this.interestService.createAccount(createAccountDto);

            res.status(HttpStatus.CREATED).json({
                success: true,
                data: {
                    id: account.id,
                    balance: account.balance,
                    createdAt: account.createdAt,
                },
            });
        } catch (error) {
            console.error('Create account error:', error);
            res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create account',
            });
        }
    }

    /**
     * GET /accounts/:id
     * Get account details by ID
     */
    @Get(':id')
    async getAccountById(@Param('id') id: string, @Res() res: Response): Promise<void> {
        try {
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
        } catch (error) {
            console.error('Get account error:', error);
            // Naive error handling: assume 500 unless specifically not found
            // In a real app, use a proper exception filter or check error types
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: error.message,
                });
            } else {
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
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
        try {
            const date = calculateInterestDto.date ? new Date(calculateInterestDto.date) : new Date();
            const result = await this.interestService.calculateDailyInterest(id, date);

            res.status(result.isNew ? HttpStatus.CREATED : HttpStatus.OK).json({
                success: true,
                message: result.isNew
                    ? 'Interest calculated successfully'
                    : 'Interest already calculated for this date (idempotent response)',
                data: result,
            });
        } catch (error) {
            console.error('Calculate interest error:', error);
            res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to calculate interest',
            });
        }
    }

    /**
     * GET /accounts/:id/interest-history
     * Get interest calculation history for an account
     */
    @Get(':id/interest-history')
    async getAccountInterestHistory(
        @Param('id') id: string,
        @Query('limit') limit: string,
        @Res() res: Response
    ): Promise<void> {
        try {
            const limitNum = parseInt(limit) || 30;
            const history = await this.interestService.getInterestHistory(id, limitNum);

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
        } catch (error) {
            console.error('Get interest history error:', error);
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: error.message,
                });
            } else {
                res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    error: 'Internal server error',
                });
            }
        }
    }
}
