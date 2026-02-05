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

        res.status(statusCode).json(result);
    }

    @Get(':id')
    async getWalletById(@Param('id') id: string, @Res() res: Response): Promise<void> {
        const result = await this.transferService.getWalletDetails(id);
        res.status(HttpStatus.OK).json(result);
    }

    @Post('create-wallet')
    async createNewWallet(@Body() createWalletDto: CreateWalletDto, @Res() res: Response): Promise<void> {
        const result = await this.transferService.createWallet(createWalletDto);
        res.status(HttpStatus.CREATED).json(result);
    }

    @Get(':id/transactions')
    async getWalletTransactions(
        @Param('id') id: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Res() res: Response
    ): Promise<void> {
        const result = await this.transferService.getTransactionHistory(id, limit);
        res.status(HttpStatus.OK).json(result);
    }

    @Get(':id/ledger')
    async getWalletLedger(
        @Param('id') id: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
        @Res() res: Response
    ): Promise<void> {
        const result = await this.transferService.getLedgerEntries(id, limit);
        res.status(HttpStatus.OK).json(result);
    }
}
