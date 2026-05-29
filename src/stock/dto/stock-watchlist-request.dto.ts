import { IsNotEmpty, IsString } from 'class-validator';

export class StockWatchlistRequestDto {
	@IsNotEmpty()
	@IsString()
	name: string;

	@IsNotEmpty()
	@IsString()
	code: string;
}
