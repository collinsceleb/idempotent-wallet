import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { Transaction, UniqueConstraintError, Op, Sequelize } from 'sequelize';
import { SEQUELIZE } from '../../database/index';
import { Wallet, TransactionLog, TransactionStatus, Ledger, LedgerEntryType } from './entities/index';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';

export interface TransferResult {
    success: boolean;
    transactionLog: TransactionLog;
    message: string;
    isIdempotent?: boolean;
}

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
        private readonly sequelize: Sequelize
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

        const existingTransaction = await TransactionLog.findOne({
            where: { idempotencyKey },
        });

        if (existingTransaction) {
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

            return {
                success: true,
                transactionLog,
                message: 'Transfer completed successfully',
            };
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

    async getWalletOrThrow(walletId: string): Promise<Wallet> {
        const wallet = await this.getWallet(walletId);
        if (!wallet) {
            throw new WalletNotFoundError(walletId);
        }
        return wallet;
    }

    async createWallet(createWalletDto: CreateWalletDto): Promise<Wallet> {
        const initialBalance = createWalletDto.initialBalance || 0;

        if (initialBalance < 0) {
            throw new InvalidTransferError('Initial balance cannot be negative');
        }

        return Wallet.create({
            balance: initialBalance,
        });
    }

    async getTransactionHistory(
        walletId: string,
        limit: number = 50
    ): Promise<TransactionLog[]> {
        await this.getWalletOrThrow(walletId);

        return TransactionLog.findAll({
            where: {
                [Op.or]: [{ fromWalletId: walletId }, { toWalletId: walletId }],
            },
            order: [['createdAt', 'DESC']],
            limit,
        });
    }

    async getLedgerEntries(
        walletId: string,
        limit: number = 50
    ): Promise<Ledger[]> {
        await this.getWalletOrThrow(walletId);

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
}
