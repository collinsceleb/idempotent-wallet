import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    executeTransfer,
    createWallet,
    getTransactionHistory,
    getLedgerEntries,
    InsufficientFundsError,
    WalletNotFoundError,
    InvalidTransferError,
    getWalletOrThrow,
} from '../services/index.js';

/**
 * POST /transfer
 * Execute a transfer between two wallets with idempotency support.
 *
 * Required headers:
 * - Idempotency-Key: Unique key to prevent duplicate processing
 *
 * Request body:
 * - fromWalletId: Source wallet UUID
 * - toWalletId: Destination wallet UUID
 * - amount: Transfer amount (positive number)
 */
export async function transfer(req: Request, res: Response): Promise<void> {
    try {
        // Get idempotency key from header or generate one
        const idempotencyKey =
            (req.headers['idempotency-key'] as string) ||
            (req.headers['x-idempotency-key'] as string) ||
            uuidv4();

        const { fromWalletId, toWalletId, amount } = req.body || {};

        // Validate required fields
        if (!fromWalletId || !toWalletId || amount === undefined) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: fromWalletId, toWalletId, amount',
            });
            return;
        }

        // Validate amount is a number
        const transferAmount = parseFloat(amount);
        if (isNaN(transferAmount)) {
            res.status(400).json({
                success: false,
                error: 'Amount must be a valid number',
            });
            return;
        }

        const result = await executeTransfer({
            idempotencyKey,
            fromWalletId,
            toWalletId,
            amount: transferAmount,
        });

        // Return appropriate status code
        const statusCode = result.isIdempotent ? 200 : 201;

        res.status(statusCode).json({
            success: result.success,
            message: result.message,
            data: {
                transactionId: result.transactionLog.id,
                idempotencyKey: result.transactionLog.idempotencyKey,
                fromWalletId: result.transactionLog.fromWalletId,
                toWalletId: result.transactionLog.toWalletId,
                amount: result.transactionLog.amount,
                status: result.transactionLog.status,
                createdAt: result.transactionLog.createdAt,
            },
            isIdempotent: result.isIdempotent || false,
        });
    } catch (error) {
        if (error instanceof InvalidTransferError) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
            return;
        }

        if (error instanceof WalletNotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
            return;
        }

        if (error instanceof InsufficientFundsError) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
            return;
        }

        console.error('Transfer error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * GET /wallets/:id
 * Get wallet details by ID
 */
export async function getWalletById(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;

        const wallet = await getWalletOrThrow(id);

        res.json({
            success: true,
            data: {
                id: wallet.id,
                balance: wallet.balance,
                createdAt: wallet.createdAt,
                updatedAt: wallet.updatedAt,
            },
        });
    } catch (error) {
        if (error instanceof WalletNotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
            return;
        }
        console.error('Get wallet error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * POST /wallets
 * Create a new wallet with optional initial balance
 */
export async function createNewWallet(req: Request, res: Response): Promise<void> {
    try {
        const { initialBalance = 0 } = req.body || {};
        console.log('Controller received initialBalance:', initialBalance);

        const balance = parseFloat(initialBalance);
        console.log('Controller parsed balance:', balance);

        if (isNaN(balance)) {
            res.status(400).json({
                success: false,
                error: 'Initial balance must be a valid number',
            });
            return;
        }

        const wallet = await createWallet(balance);

        res.status(201).json({
            success: true,
            data: {
                id: wallet.id,
                balance: wallet.balance,
                createdAt: wallet.createdAt,
            },
        });
    } catch (error) {
        if (error instanceof InvalidTransferError) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
            return;
        }

        console.error('Create wallet error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * GET /wallets/:id/transactions
 * Get transaction history for a wallet
 */
export async function getWalletTransactions(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const limit = parseInt(req.query.limit as string) || 50;

        // Verify wallet exists (handled by service)
        await getWalletOrThrow(id);

        const transactions = await getTransactionHistory(id, limit);

        res.json({
            success: true,
            data: transactions.map((tx) => ({
                id: tx.id,
                idempotencyKey: tx.idempotencyKey,
                fromWalletId: tx.fromWalletId,
                toWalletId: tx.toWalletId,
                amount: tx.amount,
                status: tx.status,
                errorMessage: tx.errorMessage,
                createdAt: tx.createdAt,
            })),
        });
    } catch (error) {
        if (error instanceof WalletNotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
            return;
        }

        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}

/**
 * GET /wallets/:id/ledger
 * Get ledger entries for a wallet (double-entry bookkeeping)
 */
export async function getWalletLedger(req: Request, res: Response): Promise<void> {
    try {
        const id = req.params.id as string;
        const limit = parseInt(req.query.limit as string) || 50;

        // Verify wallet exists (handled by service)
        await getWalletOrThrow(id);

        const ledgerEntries = await getLedgerEntries(id, limit);

        res.json({
            success: true,
            data: ledgerEntries.map((entry) => ({
                id: entry.id,
                entryType: entry.entryType,
                amount: entry.amount,
                balanceBefore: entry.balanceBefore,
                balanceAfter: entry.balanceAfter,
                description: entry.description,
                transactionLogId: entry.transactionLogId,
                createdAt: entry.createdAt,
            })),
        });
    } catch (error) {
        if (error instanceof WalletNotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
            return;
        }

        console.error('Get ledger error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}
