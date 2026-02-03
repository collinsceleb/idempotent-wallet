import { Decimal } from 'decimal.js';
import { UniqueConstraintError } from 'sequelize';
import { Account, InterestLog } from '../models/index.js';

// Configure Decimal.js for high precision
Decimal.set({
    precision: 20,
    rounding: Decimal.ROUND_HALF_UP,
});

// Annual interest rate: 27.5%
export const ANNUAL_INTEREST_RATE = new Decimal('0.275');

/**
 * Determines if a year is a leap year.
 * A year is a leap year if:
 * - Divisible by 4 AND
 * - (Not divisible by 100 OR divisible by 400)
 */
export function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Gets the number of days in a given year.
 */
export function getDaysInYear(year: number): number {
    return isLeapYear(year) ? 366 : 365;
}

/**
 * Calculates the daily interest rate for a given year.
 * Daily rate = Annual rate / Days in year
 */
export function calculateDailyRate(year: number): Decimal {
    const daysInYear = getDaysInYear(year);
    return ANNUAL_INTEREST_RATE.dividedBy(daysInYear);
}

/**
 * Calculates the interest amount for a given principal and daily rate.
 * Interest = Principal * Daily Rate
 */
export function calculateInterest(principal: Decimal, dailyRate: Decimal): Decimal {
    return principal.times(dailyRate);
}

/**
 * Calculates the new balance after applying interest.
 * New Balance = Principal + Interest
 */
export function calculateNewBalance(principal: Decimal, interest: Decimal): Decimal {
    return principal.plus(interest);
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
}

/**
 * Calculates and records daily interest for an account.
 *
 * Features:
 * - Uses Decimal.js for precision (no floating-point errors)
 * - Handles leap years correctly (366 vs 365 days)
 * - Idempotent: Will not calculate twice for the same date
 * - Records all calculation parameters for audit trail
 *
 * @param accountId - The account to calculate interest for
 * @param date - The date to calculate interest for (defaults to today)
 * @returns The result of the interest calculation
 */
export async function calculateDailyInterest(
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
        throw new Error(`Account not found: ${accountId}`);
    }

    // Calculate interest using Decimal.js for precision
    const principal = new Decimal(account.balance);
    const daysInYear = getDaysInYear(year);
    const dailyRate = calculateDailyRate(year);
    const interest = calculateInterest(principal, dailyRate);
    const newBalance = calculateNewBalance(principal, interest);

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

/**
 * Calculates interest for a range of dates (for batch processing).
 *
 * @param accountId - The account to calculate interest for
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @returns Array of daily interest results
 */
export async function calculateInterestForDateRange(
    accountId: string,
    startDate: Date,
    endDate: Date
): Promise<DailyInterestResult[]> {
    const results: DailyInterestResult[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const result = await calculateDailyInterest(accountId, new Date(currentDate));
        results.push(result);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
}

/**
 * Gets the interest history for an account.
 */
export async function getInterestHistory(
    accountId: string,
    limit: number = 30
): Promise<InterestLog[]> {
    return InterestLog.findAll({
        where: { accountId },
        order: [['calculationDate', 'DESC']],
        limit,
    });
}

/**
 * Creates a new account with an optional initial balance.
 */
export async function createAccount(initialBalance: string = '0'): Promise<Account> {
    const balance = new Decimal(initialBalance);

    if (balance.isNegative()) {
        throw new Error('Initial balance cannot be negative');
    }

    return Account.create({
        balance: balance.toFixed(8),
    });
}

/**
 * Gets an account by ID.
 */
export async function getAccount(accountId: string): Promise<Account | null> {
    return Account.findByPk(accountId);
}
