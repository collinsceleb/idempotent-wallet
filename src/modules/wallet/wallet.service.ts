import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Transaction, UniqueConstraintError, Op, Sequelize } from 'sequelize';
import { SEQUELIZE } from '../../database/index';
import { REDIS } from '../../common/redis/redis.module';
import { Wallet, TransactionLog, TransactionStatus, Ledger, LedgerEntryType } from './entities/index';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    isIdempotent?: boolean;
}

export interface TransferResponseData {
    transactionId: string;
    idempotencyKey: string;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    status: TransactionStatus;
    createdAt: Date;
}

export interface TransferResult extends ApiResponse<TransferResponseData> { }

export class InsufficientFundsError extends HttpException {
    constructor(message: string = 'Insufficient funds') {
        super(message, HttpStatus.BAD_REQUEST);
    }
}

export class WalletNotFoundError extends HttpException {
    constructor(walletId: string) {
        super(`Wallet not found: ${walletId}`, HttpStatus.NOT_FOUND);
    }
}

export class InvalidTransferError extends HttpException {
    constructor(message: string) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}

export class IdempotencyKeyNotFoundError extends HttpException {
    constructor(message: string) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}

@Injectable()
export class TransferService {
    constructor(
        @Inject(SEQUELIZE)
        private readonly sequelize: Sequelize,
        @Inject(REDIS)
        private readonly redis: Redis
    ) { }

    /**
     * Executes a transfer between two wallets with idempotency and race condition handling.
     */
    async executeTransfer(request: TransferDto, idempotencyKey: string): Promise<TransferResult> {
        const { fromWalletId, toWalletId, amount } = request;

        if (!idempotencyKey) {
            throw new IdempotencyKeyNotFoundError('Idempotency-Key header is required for transfers.');
        }
        if (amount <= 0) {
            throw new InvalidTransferError('Transfer amount must be greater than zero');
        }

        if (fromWalletId === toWalletId) {
            throw new InvalidTransferError('Cannot transfer to the same wallet');
        }

        const cacheKey = `idempotency:${idempotencyKey}`;
        const cachedResult = await this.redis.get(cacheKey);

        if (cachedResult) {
            return JSON.parse(cachedResult);
        }

        const existingTransaction = await TransactionLog.findOne({
            where: { idempotencyKey },
        });

        if (existingTransaction) {
            const result: TransferResult = {
                success: existingTransaction.status === TransactionStatus.COMPLETED,
                message:
                    existingTransaction.status === TransactionStatus.COMPLETED
                        ? 'Transfer already completed (idempotent response)'
                        : `Transfer previously ${existingTransaction.status.toLowerCase()}`,
                data: {
                    transactionId: existingTransaction.id,
                    idempotencyKey: existingTransaction.idempotencyKey,
                    fromWalletId: existingTransaction.fromWalletId,
                    toWalletId: existingTransaction.toWalletId,
                    amount: existingTransaction.amount,
                    status: existingTransaction.status,
                    createdAt: existingTransaction.createdAt,
                },
                isIdempotent: true,
            };

            await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 86400); // 24 hours
            return result;
        }

        const transaction = await this.sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        });

        let transactionLog: TransactionLog | null = null;

        try {
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

            const fromWallet = fromWalletId === firstWalletId ? firstWallet : secondWallet;
            const toWallet = toWalletId === firstWalletId ? firstWallet : secondWallet;

            if (!fromWallet) {
                throw new WalletNotFoundError(fromWalletId);
            }

            if (!toWallet) {
                throw new WalletNotFoundError(toWalletId);
            }

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
                if (error instanceof UniqueConstraintError) {
                    await transaction.rollback();

                    const existingLog = await TransactionLog.findOne({
                        where: { idempotencyKey },
                    });

                    if (existingLog) {
                        const result: TransferResult = {
                            success: existingLog.status === TransactionStatus.COMPLETED,
                            message: 'Transfer processed by concurrent request (idempotent response)',
                            data: {
                                transactionId: existingLog.id,
                                idempotencyKey: existingLog.idempotencyKey,
                                fromWalletId: existingLog.fromWalletId,
                                toWalletId: existingLog.toWalletId,
                                amount: existingLog.amount,
                                status: existingLog.status,
                                createdAt: existingLog.createdAt,
                            },
                            isIdempotent: true,
                        };

                        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 86400);
                        return result;
                    }

                    throw new Error('Failed to retrieve existing transaction log');
                }
                throw error;
            }

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

            await transactionLog.update(
                {
                    status: TransactionStatus.COMPLETED,
                },
                { transaction }
            );

            await transaction.commit();

            await transactionLog.reload();

            const result: TransferResult = {
                success: true,
                message: 'Transfer completed successfully',
                data: {
                    transactionId: transactionLog.id,
                    idempotencyKey: transactionLog.idempotencyKey,
                    fromWalletId: transactionLog.fromWalletId,
                    toWalletId: transactionLog.toWalletId,
                    amount: transactionLog.amount,
                    status: transactionLog.status,
                    createdAt: transactionLog.createdAt,
                }
            };

            await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 86400);
            return result;
        } catch (error) {
            try {
                await transaction.rollback();
            } catch {
            }
            if (
                error instanceof InsufficientFundsError ||
                error instanceof WalletNotFoundError ||
                error instanceof InvalidTransferError
            ) {
                throw error;
            }

            if (transactionLog) {
                try {
                    await transactionLog.update({
                        status: TransactionStatus.FAILED,
                        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
                    });
                } catch {
                }
            }

            throw error;
        }
    }

    async getWallet(walletId: string): Promise<Wallet | null> {
        return Wallet.findByPk(walletId);
    }

    async getWalletDetails(walletId: string): Promise<ApiResponse> {
        const wallet = await this.getWallet(walletId);
        if (!wallet) {
            throw new WalletNotFoundError(walletId);
        }
        return {
            success: true,
            data: {
                id: wallet.id,
                balance: wallet.balance,
                createdAt: wallet.createdAt,
                updatedAt: wallet.updatedAt,
            }
        };
    }

    async createWallet(createWalletDto: CreateWalletDto): Promise<ApiResponse> {
        const initialBalance = createWalletDto.initialBalance || 0;

        if (initialBalance < 0) {
            throw new InvalidTransferError('Initial balance cannot be negative');
        }

        const wallet = await Wallet.create({
            balance: initialBalance,
        });

        return {
            success: true,
            data: {
                id: wallet.id,
                balance: wallet.balance,
                createdAt: wallet.createdAt,
            }
        };
    }

    async getTransactionHistory(
        walletId: string,
        limit: number = 50
    ): Promise<ApiResponse> {
        await this.getWalletDetails(walletId);

        const transactions = await TransactionLog.findAll({
            where: {
                [Op.or]: [{ fromWalletId: walletId }, { toWalletId: walletId }],
            },
            order: [['createdAt', 'DESC']],
            limit,
        });

        return {
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
        };
    }

    async getLedgerEntries(
        walletId: string,
        limit: number = 50
    ): Promise<ApiResponse> {
        await this.getWalletDetails(walletId);

        const ledgerEntries = await Ledger.findAll({
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

        return {
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
        };
    }
}
