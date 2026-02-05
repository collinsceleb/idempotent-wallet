import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { UniqueConstraintError } from 'sequelize';
import { Account, InterestLog } from './entities/index';
import { CreateAccountDto } from './dto/create-account.dto';

export class AccountNotFoundError extends HttpException {
    constructor(accountId: string) {
        super(`Account not found: ${accountId}`, HttpStatus.NOT_FOUND);
    }
}

export class InvalidBalanceError extends HttpException {
    constructor(message: string) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}

Decimal.set({
    precision: 20,
    rounding: Decimal.ROUND_HALF_UP,
});
export const ANNUAL_INTEREST_RATE = new Decimal('0.275');

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
}

export interface DailyInterestResult {
    accountId: string;
    calculationDate: string;
    principalBalance: string;
    interestAmount: string;
    annualRate: string;
    dailyRate: string;
    daysInYear: number;
    newBalance: string;
    isNew: boolean;
    createdAt?: Date;
}

export interface InterestCalculationResponse extends ApiResponse<DailyInterestResult> {
    isNew?: boolean;
}

@Injectable()
export class InterestService {
    /**
     * Determines if a year is a leap year.
     */
    isLeapYear(year: number): boolean {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    /**
     * Gets the number of days in a given year.
     */
    getDaysInYear(year: number): number {
        return this.isLeapYear(year) ? 366 : 365;
    }

    /**
     * Calculates the daily interest rate for a given year.
     */
    calculateDailyRate(year: number): Decimal {
        const daysInYear = this.getDaysInYear(year);
        return ANNUAL_INTEREST_RATE.dividedBy(daysInYear);
    }

    /**
     * Calculates the interest amount for a given principal and daily rate.
     */
    calculateInterest(principal: Decimal, dailyRate: Decimal): Decimal {
        return principal.times(dailyRate);
    }

    /**
     * Calculates the new balance after applying interest.
     */
    calculateNewBalance(principal: Decimal, interest: Decimal): Decimal {
        return principal.plus(interest);
    }

    /**
     * Calculates and records daily interest for an account.
     */
    async calculateDailyInterest(
        accountId: string,
        date: Date = new Date()
    ): Promise<InterestCalculationResponse> {
        const calculationDate = date.toISOString().split('T')[0];
        const year = date.getFullYear();

        const existingLog = await InterestLog.findOne({
            where: {
                accountId,
                calculationDate,
            },
        });

        if (existingLog) {
            return {
                success: true,
                message: 'Interest already calculated for this date (idempotent response)',
                isNew: false,
                data: {
                    accountId: existingLog.accountId,
                    calculationDate: existingLog.calculationDate,
                    principalBalance: existingLog.principalBalance,
                    interestAmount: existingLog.interestAmount,
                    annualRate: existingLog.annualRate,
                    dailyRate: new Decimal(existingLog.annualRate)
                        .dividedBy(existingLog.daysInYear)
                        .toFixed(8),
                    daysInYear: existingLog.daysInYear,
                    newBalance: existingLog.newBalance,
                    isNew: false,
                    createdAt: existingLog.createdAt,
                }
            };
        }

        const account = await Account.findByPk(accountId);
        if (!account) {
            throw new AccountNotFoundError(accountId);
        }
        const principal = new Decimal(account.balance);
        const daysInYear = this.getDaysInYear(year);
        const dailyRate = this.calculateDailyRate(year);
        const interest = this.calculateInterest(principal, dailyRate);
        const newBalance = this.calculateNewBalance(principal, interest);

        try {
            const interestLog = await InterestLog.create({
                accountId,
                calculationDate,
                principalBalance: principal.toFixed(8),
                interestAmount: interest.toFixed(8),
                annualRate: ANNUAL_INTEREST_RATE.toFixed(6),
                daysInYear,
                newBalance: newBalance.toFixed(8),
            });

            await account.update({
                balance: newBalance.toFixed(8),
            });

            return {
                success: true,
                message: 'Interest calculated successfully',
                isNew: true,
                data: {
                    accountId: interestLog.accountId,
                    calculationDate: interestLog.calculationDate,
                    principalBalance: interestLog.principalBalance,
                    interestAmount: interestLog.interestAmount,
                    annualRate: interestLog.annualRate,
                    dailyRate: dailyRate.toFixed(8),
                    daysInYear: interestLog.daysInYear,
                    newBalance: interestLog.newBalance,
                    isNew: true,
                    createdAt: interestLog.createdAt,
                }
            };
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                const existingLog = await InterestLog.findOne({
                    where: {
                        accountId,
                        calculationDate,
                    },
                });

                if (existingLog) {
                    return {
                        success: true,
                        message: 'Interest already calculated for this date (idempotent response)',
                        isNew: false,
                        data: {
                            accountId: existingLog.accountId,
                            calculationDate: existingLog.calculationDate,
                            principalBalance: existingLog.principalBalance,
                            interestAmount: existingLog.interestAmount,
                            annualRate: existingLog.annualRate,
                            dailyRate: new Decimal(existingLog.annualRate)
                                .dividedBy(existingLog.daysInYear)
                                .toFixed(8),
                            daysInYear: existingLog.daysInYear,
                            newBalance: existingLog.newBalance,
                            isNew: false,
                            createdAt: existingLog.createdAt,
                        }
                    };
                }
            }

            throw error;
        }
    }

    async getInterestHistory(
        accountId: string,
        limit: number = 30
    ): Promise<ApiResponse> {
        await this.getAccountDetails(accountId);

        const history = await InterestLog.findAll({
            where: { accountId },
            order: [['calculationDate', 'DESC']],
            limit,
        });

        return {
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
        };
    }

    async createAccount(createAccountDto: CreateAccountDto): Promise<ApiResponse> {
        const initialBalance = createAccountDto.initialBalance || '0';
        const balance = new Decimal(initialBalance);

        if (balance.isNegative()) {
            throw new InvalidBalanceError('Initial balance cannot be negative');
        }

        const account = await Account.create({
            balance: balance.toFixed(8),
        });

        return {
            success: true,
            data: {
                id: account.id,
                balance: account.balance,
                createdAt: account.createdAt,
            }
        };
    }

    async getAccount(accountId: string): Promise<Account | null> {
        return Account.findByPk(accountId);
    }

    async getAccountDetails(accountId: string): Promise<ApiResponse> {
        const account = await this.getAccount(accountId);
        if (!account) {
            throw new AccountNotFoundError(accountId);
        }
        return {
            success: true,
            data: {
                id: account.id,
                balance: account.balance,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
            }
        };
    }
}
