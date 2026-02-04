import { IsOptional, IsDateString } from 'class-validator';

export class CalculateInterestDto {
    @IsOptional()
    @IsDateString()
    date?: string;
}
