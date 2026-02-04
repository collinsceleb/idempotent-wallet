import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    Headers,
    Res,
    HttpStatus
} from '@nestjs/common';
import { Response } from 'express';
import {
    TransferService,
    InsufficientFundsError,
    WalletNotFoundError,
    InvalidTransferError,
    IdempotencyKeyNotFoundError
} from '../services/transfer.service';
import { CreateWalletDto } from '../dto/create-wallet.dto';
import { TransferDto } from '../dto/transfer.dto';

@Controller('wallets')
export class TransferController {
    constructor(private readonly transferService: TransferService) { }

    /**
     * POST /wallets/transfer
     * Execute a transfer between two wallets with idempotency support.
     */
    @Post('transfer')
    async transfer(
        @Body() transferDto: TransferDto,
        @Headers('idempotency-key') idempotencyKey: string,
        @Headers('x-idempotency-key') xIdempotencyKey: string,
        @Res() res: Response
    ): Promise<void> {
        const key = idempotencyKey || xIdempotencyKey;

        try {
            // Note: Validation is now handled by TransferDto and ValidationPipe

            const result = await this.transferService.executeTransfer(transferDto, key);

            // Return appropriate status code
            const statusCode = result.isIdempotent ? HttpStatus.OK : HttpStatus.CREATED;

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
            if (error instanceof InvalidTransferError || error instanceof IdempotencyKeyNotFoundError) {
                res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            if (error instanceof WalletNotFoundError) {
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            if (error instanceof InsufficientFundsError) {
                res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            console.error('Transfer error:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }

    /**
     * GET /wallets/:id
     * Get wallet details by ID
     */
    @Get(':id')
    async getWalletById(@Param('id') id: string, @Res() res: Response): Promise<void> {
        try {
            const wallet = await this.transferService.getWalletOrThrow(id);

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
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: error.message,
                });
                return;
            }
            console.error('Get wallet error:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }

    /**
     * POST /wallets
     * Create a new wallet with optional initial balance
     */
    @Post()
    async createNewWallet(@Body() createWalletDto: CreateWalletDto, @Res() res: Response): Promise<void> {
        try {
            const wallet = await this.transferService.createWallet(createWalletDto);

            res.status(HttpStatus.CREATED).json({
                success: true,
                data: {
                    id: wallet.id,
                    balance: wallet.balance,
                    createdAt: wallet.createdAt,
                },
            });
        } catch (error) {
            if (error instanceof InvalidTransferError) {
                res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            console.error('Create wallet error:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }

    /**
     * GET /wallets/:id/transactions
     * Get transaction history for a wallet
     */
    @Get(':id/transactions')
    async getWalletTransactions(
        @Param('id') id: string,
        @Query('limit') limit: string,
        @Res() res: Response
    ): Promise<void> {
        console.log(`Getting transactions for wallet ${id}`);
        try {
            const limitNum = parseInt(limit) || 50;
            const transactions = await this.transferService.getTransactionHistory(id, limitNum);

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
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            console.error('Get transactions error:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }

    /**
     * GET /wallets/:id/ledger
     * Get ledger entries for a wallet (double-entry bookkeeping)
     */
    @Get(':id/ledger')
    async getWalletLedger(
        @Param('id') id: string,
        @Query('limit') limit: string,
        @Res() res: Response
    ): Promise<void> {
        try {
            const limitNum = parseInt(limit) || 50;
            const ledgerEntries = await this.transferService.getLedgerEntries(id, limitNum);

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
                res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            console.error('Get ledger error:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
}
