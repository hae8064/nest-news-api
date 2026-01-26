// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { LoginRequest } from './dto/request/loginRequest';
import { RegisterRequest } from './dto/request/registerRequest';
import { UserRole } from 'src/common/enums/userRole.enum';
import { LoginResponse } from './dto/response/loginResponse';
import { JwtPayload } from './interface/jwt-payload.interface';

@Injectable()
export class AuthService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		private readonly jwtService: JwtService,
	) {}

	// 일반 사용자 회원가입
	async registerUser(registerRequest: RegisterRequest) {
		const { email, password, name } = registerRequest;

		const hashedPassword = await bcrypt.hash(password, 10);

		const user = this.userRepository.create({
			email,
			password: hashedPassword,
			name,
			role: UserRole.USER,
		});

		return this.userRepository.save(user);
	}

	// 관리자 회원가입
	async registerAdmin(registerRequest: RegisterRequest) {
		const { email, password, name } = registerRequest;

		const hashedPassword = await bcrypt.hash(password, 10);

		const user = this.userRepository.create({
			email,
			password: hashedPassword,
			name,
			role: UserRole.ADMIN,
		});

		return this.userRepository.save(user);
	}

	async login(loginRequest: LoginRequest): Promise<LoginResponse> {
		const { email, password } = loginRequest;

		const user = await this.userRepository.findOne({
			where: { email },
		});

		if (!user) {
			throw new UnauthorizedException(
				'이메일 또는 비밀번호가 올바르지 않습니다.',
			);
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);

		if (!isPasswordValid) {
			throw new UnauthorizedException(
				'이메일 또는 비밀번호가 올바르지 않습니다.',
			);
		}

		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
		};
		const accessToken = this.jwtService.sign(payload);
		const refreshToken = this.jwtService.sign(payload, {
			secret: process.env.JWT_REFRESH_SECRET_KEY,
			expiresIn: '7d',
		});

		user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
		await this.userRepository.save(user);

		return {
			accessToken,
			refreshToken,
			user: {
				email: user.email,
				name: user.name,
				role: user.role,
			},
		};
	}

	async refreshToken(refreshToken: string): Promise<LoginResponse> {
		// refreshToken JWT 검증
		let payload: JwtPayload;
		try {
			payload = this.jwtService.verify(refreshToken, {
				secret: process.env.JWT_REFRESH_SECRET_KEY,
			});
		} catch {
			throw new UnauthorizedException(
				'리프레시 토큰이 만료되었거나 유효하지 않습니다.',
			);
		}

		// userId로 사용자 조회
		const user = await this.userRepository.findOne({
			where: { id: payload.sub },
		});

		if (!user || !user.refreshTokenHash) {
			throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다.');
		}

		// 3️⃣ refreshToken hash 비교
		const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
		if (!isValid) {
			throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다.');
		}

		// 4️⃣ 새 토큰 발급
		const newPayload: JwtPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
		};

		const accessToken = this.jwtService.sign(newPayload);

		const newRefreshToken = this.jwtService.sign(newPayload, {
			secret: process.env.JWT_REFRESH_SECRET_KEY,
			expiresIn: '7d',
		});

		// refreshToken 전환
		user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
		await this.userRepository.save(user);

		return {
			accessToken,
			refreshToken: newRefreshToken,
			user: {
				email: user.email,
				name: user.name,
				role: user.role,
			},
		};
	}

	async validateUser(userId: number): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		if (!user) {
			throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
		}

		return user;
	}

	async logout(userId: number) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
		});

		if (!user) {
			throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
		}

		user.refreshTokenHash = null;
		await this.userRepository.save(user);

		return { message: '로그아웃 되었습니다.' };
	}
}
