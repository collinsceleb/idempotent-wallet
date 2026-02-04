import { Request, Response } from 'express';
import {
    calculateDailyInterest,
    getInterestHistory,
    createAccount,
    getAccountOrThrow,
} from '../services/index.js';

/**
 * POST /accounts
 * Create a new account with optional initial balance
 */
export async function createNewAccount(req: Request, res: Response): Promise<void> {
    try {
        const { initialBalance = '0' } = req.body;

        const account = await createAccount(initialBalance);

        res.status(201).json({
            success: true,
            data: {
                id: account.id,
                balance: account.balance,
                createdAt: account.createdAt,
            },
        });
    } catch (error) {
        console.error('Create account error:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create account',
        });
    }
}

/**
 * GET /accounts/:id
 * Get account details by ID
 */
export async function getAccountById(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;

        const account = await getAccountOrThrow(id);

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
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * POST /accounts/:id/calculate-interest
 * Calculate daily interest for an account
 */
export async function calculateInterest(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const { date } = req.body;

        const calculationDate = date ? new Date(date) : new Date();

        if (isNaN(calculationDate.getTime())) {
            res.status(400).json({
                success: false,
                error: 'Invalid date format',
            });
            return;
        }

        const result = await calculateDailyInterest(id, calculationDate);

        res.status(result.isNew ? 201 : 200).json({
            success: true,
            message: result.isNew
                ? 'Interest calculated successfully'
                : 'Interest already calculated for this date (idempotent response)',
            data: result,
        });
    } catch (error) {
        console.error('Calculate interest error:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to calculate interest',
        });
    }
}

/**
 * GET /accounts/:id/interest-history
 * Get interest calculation history for an account
 */
export async function getAccountInterestHistory(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const limit = parseInt(req.query.limit as string) || 30;

        // Verify account exists (handled by service)
        await getAccountOrThrow(id);

        const history = await getInterestHistory(id, limit);

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
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}
