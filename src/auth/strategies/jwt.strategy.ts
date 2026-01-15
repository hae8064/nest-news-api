// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interface/jwt-payload.interface';
import { User } from '../user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	constructor(
		private readonly configService: ConfigService,
		private readonly authService: AuthService,
	) {
		const secret = configService.get<string>('JWT_ACCESS_SECRET_KEY');

		if (!secret) {
			throw new Error('JWT_ACCESS_SECRET_KEY is not set');
		}

		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: secret,
		});
	}

	async validate(payload: JwtPayload): Promise<User> {
		const user = await this.authService.validateUser(payload.sub);
		if (!user) {
			throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
		}
		return user;
	}
}
