import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class TransferDto {
    @IsNotEmpty()
    @IsUUID()
    fromWalletId!: string;

    @IsNotEmpty()
    @IsUUID()
    toWalletId!: string;

    @IsNotEmpty()
    @IsNumber()
    @IsPositive()
    amount!: number;
}
