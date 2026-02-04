import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { UniqueConstraintError } from 'sequelize';
import { Account, InterestLog } from './models/index';
import { CreateAccountDto } from './dto/create-account.dto';

// Custom Exceptions
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

// Configure Decimal.js for high precision
Decimal.set({
    precision: 20,
    rounding: Decimal.ROUND_HALF_UP,
});

// Annual interest rate: 27.5%
export const ANNUAL_INTEREST_RATE = new Decimal('0.275');

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
    ): Promise<DailyInterestResult> {
        // Format date as YYYY-MM-DD for DATEONLY field
        const calculationDate = date.toISOString().split('T')[0];
        const year = date.getFullYear();

        // Check if interest has already been calculated for this date (idempotency)
        const existingLog = await InterestLog.findOne({
            where: {
                accountId,
                calculationDate,
            },
        });

        if (existingLog) {
            // Return existing calculation result
            return {
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
            };
        }

        // Fetch the account
        const account = await Account.findByPk(accountId);
        if (!account) {
            throw new AccountNotFoundError(accountId);
        }

        // Calculate interest using Decimal.js for precision
        const principal = new Decimal(account.balance);
        const daysInYear = this.getDaysInYear(year);
        const dailyRate = this.calculateDailyRate(year);
        const interest = this.calculateInterest(principal, dailyRate);
        const newBalance = this.calculateNewBalance(principal, interest);

        try {
            // Record the interest calculation
            const interestLog = await InterestLog.create({
                accountId,
                calculationDate,
                principalBalance: principal.toFixed(8),
                interestAmount: interest.toFixed(8),
                annualRate: ANNUAL_INTEREST_RATE.toFixed(6),
                daysInYear,
                newBalance: newBalance.toFixed(8),
            });

            // Update account balance
            await account.update({
                balance: newBalance.toFixed(8),
            });

            return {
                accountId: interestLog.accountId,
                calculationDate: interestLog.calculationDate,
                principalBalance: interestLog.principalBalance,
                interestAmount: interestLog.interestAmount,
                annualRate: interestLog.annualRate,
                dailyRate: dailyRate.toFixed(8),
                daysInYear: interestLog.daysInYear,
                newBalance: interestLog.newBalance,
                isNew: true,
            };
        } catch (error) {
            // Handle race condition where another process created the log
            if (error instanceof UniqueConstraintError) {
                const existingLog = await InterestLog.findOne({
                    where: {
                        accountId,
                        calculationDate,
                    },
                });

                if (existingLog) {
                    return {
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
                    };
                }
            }

            throw error;
        }
    }

    async calculateInterestForDateRange(
        accountId: string,
        startDate: Date,
        endDate: Date
    ): Promise<DailyInterestResult[]> {
        const results: DailyInterestResult[] = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const result = await this.calculateDailyInterest(accountId, new Date(currentDate));
            results.push(result);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return results;
    }

    async getInterestHistory(
        accountId: string,
        limit: number = 30
    ): Promise<InterestLog[]> {
        await this.getAccountOrThrow(accountId);

        return InterestLog.findAll({
            where: { accountId },
            order: [['calculationDate', 'DESC']],
            limit,
        });
    }

    async createAccount(createAccountDto: CreateAccountDto): Promise<Account> {
        const initialBalance = createAccountDto.initialBalance || '0';
        const balance = new Decimal(initialBalance);

        if (balance.isNegative()) {
            throw new InvalidBalanceError('Initial balance cannot be negative');
        }

        return Account.create({
            balance: balance.toFixed(8),
        });
    }

    async getAccount(accountId: string): Promise<Account | null> {
        return Account.findByPk(accountId);
    }

    async getAccountOrThrow(accountId: string): Promise<Account> {
        const account = await this.getAccount(accountId);
        if (!account) {
            throw new AccountNotFoundError(accountId);
        }
        return account;
    }
}
