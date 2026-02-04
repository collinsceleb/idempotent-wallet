import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    Headers,
    Res,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe
} from '@nestjs/common';
import { Response } from 'express';
import {
    TransferService
} from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { TransferDto } from './dto/transfer.dto';

@Controller('wallets')
export class TransferController {
    constructor(private readonly transferService: TransferService) { }

    @Post('transfer')
    async transfer(
        @Body() transferDto: TransferDto,
        @Headers('idempotency-key') idempotencyKey: string,
        @Headers('x-idempotency-key') xIdempotencyKey: string,
        @Res() res: Response
    ): Promise<void> {
        const key = idempotencyKey || xIdempotencyKey;

        const result = await this.transferService.executeTransfer(transferDto, key);

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
    }

    @Get(':id')
    async getWalletById(@Param('id') id: string, @Res() res: Response): Promise<void> {
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
    }

    @Post('create-wallet')
    async createNewWallet(@Body() createWalletDto: CreateWalletDto, @Res() res: Response): Promise<void> {
        const wallet = await this.transferService.createWallet(createWalletDto);

        res.status(HttpStatus.CREATED).json({
            success: true,
            data: {
                id: wallet.id,
                balance: wallet.balance,
                createdAt: wallet.createdAt,
            },
        });
    }

    @Get(':id/transactions')
    async getWalletTransactions(
        @Param('id') id: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Res() res: Response
    ): Promise<void> {
        console.log(`Getting transactions for wallet ${id}`);
        const transactions = await this.transferService.getTransactionHistory(id, limit);

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
    }

    @Get(':id/ledger')
    async getWalletLedger(
        @Param('id') id: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Res() res: Response
    ): Promise<void> {
        const ledgerEntries = await this.transferService.getLedgerEntries(id, limit);

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
    }
}
