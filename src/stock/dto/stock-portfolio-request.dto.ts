import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class AddPortfolioDto {
	@IsNotEmpty()
	@IsString()
	name: string;

	@IsNotEmpty()
	@IsString()
	code: string;

	@IsNotEmpty()
	@IsNumber()
	buyPrice: number;

	@IsNotEmpty()
	@IsNumber()
	quantity: number;

	@IsNotEmpty()
	@IsString()
	buyDate: string;

	@IsOptional()
	@IsString()
	memo?: string;
}

export class SellPortfolioDto {
	@IsNotEmpty()
	@IsNumber()
	sellPrice: number;

	@IsNotEmpty()
	@IsString()
	sellDate: string;
}
