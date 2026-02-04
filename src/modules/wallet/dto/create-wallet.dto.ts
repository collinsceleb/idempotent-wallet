import { IsNumber, IsOptional, Min } from 'class-validator';

export class CreateWalletDto {
    @IsOptional()
    @IsNumber()
    @Min(0)
    initialBalance?: number;
}
