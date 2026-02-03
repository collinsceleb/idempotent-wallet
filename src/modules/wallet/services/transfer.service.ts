import { Transaction, UniqueConstraintError, Op } from 'sequelize';
import { sequelize } from '../../../database/index.js';
import { Wallet, TransactionLog, TransactionStatus, Ledger, LedgerEntryType } from '../models/index.js';

export interface TransferRequest {
    idempotencyKey: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
}

export interface TransferResult {
    success: boolean;
    transactionLog: TransactionLog;
    message: string;
    isIdempotent?: boolean;
}

export class InsufficientFundsError extends Error {
    constructor(message: string = 'Insufficient funds') {
        super(message);
        this.name = 'InsufficientFundsError';
    }
}

export class WalletNotFoundError extends Error {
    constructor(walletId: string) {
        super(`Wallet not found: ${walletId}`);
        this.name = 'WalletNotFoundError';
    }
}

export class InvalidTransferError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidTransferError';
    }
}

/**
 * Executes a transfer between two wallets with idempotency and race condition handling.
 *
 * Key features:
 * 1. Idempotency: Same idempotency key returns the same result without re-processing
 * 2. Race condition prevention: Uses SELECT ... FOR UPDATE to lock wallet rows
 * 3. PENDING state: TransactionLog created with PENDING before balance changes
 * 4. Atomic transaction: All operations within a single database transaction
 */
export async function executeTransfer(request: TransferRequest): Promise<TransferResult> {
    const { idempotencyKey, fromWalletId, toWalletId, amount } = request;

    // Validate input
    if (amount <= 0) {
        throw new InvalidTransferError('Transfer amount must be greater than zero');
    }

    if (fromWalletId === toWalletId) {
        throw new InvalidTransferError('Cannot transfer to the same wallet');
    }

    // Check for existing transaction with this idempotency key (before starting transaction)
    const existingTransaction = await TransactionLog.findOne({
        where: { idempotencyKey },
    });

    if (existingTransaction) {
        // Return the existing result - idempotent behavior
        return {
            success: existingTransaction.status === TransactionStatus.COMPLETED,
            transactionLog: existingTransaction,
            message:
                existingTransaction.status === TransactionStatus.COMPLETED
                    ? 'Transfer already completed (idempotent response)'
                    : `Transfer previously ${existingTransaction.status.toLowerCase()}`,
            isIdempotent: true,
        };
    }

    // Start database transaction
    const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    let transactionLog: TransactionLog | null = null;

    try {
        // Step 1: Create TransactionLog with PENDING status BEFORE any balance changes
        // This ensures we have a record even if the process crashes
        try {
            transactionLog = await TransactionLog.create(
                {
                    idempotencyKey,
                    fromWalletId,
                    toWalletId,
                    amount,
                    status: TransactionStatus.PENDING,
                },
                { transaction }
            );
        } catch (error) {
            // Handle race condition where another request created the log first
            if (error instanceof UniqueConstraintError) {
                await transaction.rollback();

                // Fetch the existing transaction created by the other request
                const existingLog = await TransactionLog.findOne({
                    where: { idempotencyKey },
                });

                if (existingLog) {
                    return {
                        success: existingLog.status === TransactionStatus.COMPLETED,
                        transactionLog: existingLog,
                        message: 'Transfer processed by concurrent request (idempotent response)',
                        isIdempotent: true,
                    };
                }

                throw new Error('Failed to retrieve existing transaction log');
            }
            throw error;
        }

        // Step 2: Lock and fetch wallets in consistent order to prevent deadlocks
        // Always lock the wallet with the smaller ID first
        const [firstWalletId, secondWalletId] =
            fromWalletId < toWalletId ? [fromWalletId, toWalletId] : [toWalletId, fromWalletId];

        const firstWallet = await Wallet.findByPk(firstWalletId, {
            transaction,
            lock: Transaction.LOCK.UPDATE,
        });

        const secondWallet = await Wallet.findByPk(secondWalletId, {
            transaction,
            lock: Transaction.LOCK.UPDATE,
        });

        // Determine which wallet is sender and which is receiver
        const fromWallet = fromWalletId === firstWalletId ? firstWallet : secondWallet;
        const toWallet = toWalletId === firstWalletId ? firstWallet : secondWallet;

        // Validate wallets exist
        if (!fromWallet) {
            await transactionLog.update(
                {
                    status: TransactionStatus.FAILED,
                    errorMessage: `Source wallet not found: ${fromWalletId}`,
                },
                { transaction }
            );
            await transaction.commit();
            throw new WalletNotFoundError(fromWalletId);
        }

        if (!toWallet) {
            await transactionLog.update(
                {
                    status: TransactionStatus.FAILED,
                    errorMessage: `Destination wallet not found: ${toWalletId}`,
                },
                { transaction }
            );
            await transaction.commit();
            throw new WalletNotFoundError(toWalletId);
        }

        // Step 3: Check sufficient balance
        if (fromWallet.balance < amount) {
            await transactionLog.update(
                {
                    status: TransactionStatus.FAILED,
                    errorMessage: `Insufficient funds. Available: ${fromWallet.balance}, Required: ${amount}`,
                },
                { transaction }
            );
            await transaction.commit();

            throw new InsufficientFundsError(
                `Insufficient funds. Available: ${fromWallet.balance}, Required: ${amount}`
            );
        }

        // Step 4: Execute the transfer - debit sender, credit receiver
        const fromBalanceBefore = fromWallet.balance;
        const toBalanceBefore = toWallet.balance;
        const fromBalanceAfter = parseFloat((fromWallet.balance - amount).toFixed(2));
        const toBalanceAfter = parseFloat((toWallet.balance + amount).toFixed(2));

        await fromWallet.update(
            {
                balance: fromBalanceAfter,
            },
            { transaction }
        );

        await toWallet.update(
            {
                balance: toBalanceAfter,
            },
            { transaction }
        );

        // Step 5: Create ledger entries for double-entry bookkeeping
        await Ledger.create(
            {
                walletId: fromWalletId,
                transactionLogId: transactionLog.id,
                entryType: LedgerEntryType.DEBIT,
                amount,
                balanceBefore: fromBalanceBefore,
                balanceAfter: fromBalanceAfter,
                description: `Transfer to wallet ${toWalletId}`,
            },
            { transaction }
        );

        await Ledger.create(
            {
                walletId: toWalletId,
                transactionLogId: transactionLog.id,
                entryType: LedgerEntryType.CREDIT,
                amount,
                balanceBefore: toBalanceBefore,
                balanceAfter: toBalanceAfter,
                description: `Transfer from wallet ${fromWalletId}`,
            },
            { transaction }
        );

        // Step 6: Mark transaction as COMPLETED
        await transactionLog.update(
            {
                status: TransactionStatus.COMPLETED,
            },
            { transaction }
        );

        // Commit the transaction
        await transaction.commit();

        // Reload to get updated values
        await transactionLog.reload();

        return {
            success: true,
            transactionLog,
            message: 'Transfer completed successfully',
        };
    } catch (error) {
        // Rollback on any error (if not already committed)
        try {
            await transaction.rollback();
        } catch {
            // Transaction might already be committed or rolled back
        }

        // Re-throw known errors
        if (
            error instanceof InsufficientFundsError ||
            error instanceof WalletNotFoundError ||
            error instanceof InvalidTransferError
        ) {
            throw error;
        }

        // Mark transaction as failed if we have a log
        if (transactionLog) {
            try {
                await transactionLog.update({
                    status: TransactionStatus.FAILED,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
                });
            } catch {
                // Best effort - log might be rolled back
            }
        }

        throw error;
    }
}

/**
 * Get a wallet by ID
 */
export async function getWallet(walletId: string): Promise<Wallet | null> {
    return Wallet.findByPk(walletId);
}

/**
 * Create a new wallet with optional initial balance
 */
export async function createWallet(initialBalance: number = 0): Promise<Wallet> {
    if (initialBalance < 0) {
        throw new InvalidTransferError('Initial balance cannot be negative');
    }

    return Wallet.create({
        balance: initialBalance,
    });
}

/**
 * Get transaction history for a wallet
 */
export async function getTransactionHistory(
    walletId: string,
    limit: number = 50
): Promise<TransactionLog[]> {
    return TransactionLog.findAll({
        where: {
            [Op.or]: [{ fromWalletId: walletId }, { toWalletId: walletId }],
        },
        order: [['createdAt', 'DESC']],
        limit,
    });
}

/**
 * Get ledger entries for a wallet (double-entry bookkeeping records)
 */
export async function getLedgerEntries(
    walletId: string,
    limit: number = 50
): Promise<Ledger[]> {
    return Ledger.findAll({
        where: { walletId },
        order: [['createdAt', 'DESC']],
        limit,
        include: [
            {
                model: TransactionLog,
                as: 'transactionLog',
            },
        ],
    });
}

