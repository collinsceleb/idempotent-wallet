import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import {
    calculateDailyInterest,
    getInterestHistory,
    createAccount,
    getAccount,
} from '../services/index.js';

const router: RouterType = Router();

/**
 * POST /accounts
 * Create a new account with optional initial balance
 */
router.post('/accounts', async (req: Request, res: Response) => {
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
});

/**
 * GET /accounts/:id
 * Get account details by ID
 */
router.get('/accounts/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const account = await getAccount(id);

        if (!account) {
            res.status(404).json({
                success: false,
                error: 'Account not found',
            });
            return;
        }

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
});

/**
 * POST /accounts/:id/calculate-interest
 * Calculate daily interest for an account
 *
 * Optional body:
 * - date: ISO date string (defaults to today)
 */
router.post('/accounts/:id/calculate-interest', async (req: Request, res: Response) => {
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
});

/**
 * GET /accounts/:id/interest-history
 * Get interest calculation history for an account
 */
router.get('/accounts/:id/interest-history', async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const limit = parseInt(req.query.limit as string) || 30;

        // Verify account exists
        const account = await getAccount(id);
        if (!account) {
            res.status(404).json({
                success: false,
                error: 'Account not found',
            });
            return;
        }

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
});

export default router;
