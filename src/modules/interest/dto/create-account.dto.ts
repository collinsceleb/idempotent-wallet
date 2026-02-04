import { IsOptional, IsString } from 'class-validator';

export class CreateAccountDto {
    @IsOptional()
    @IsString()
    initialBalance?: string;
}
