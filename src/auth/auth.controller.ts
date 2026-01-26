import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequest } from './dto/request/registerRequest';
import { LoginRequest } from './dto/request/loginRequest';
import { LoginResponse } from './dto/response/loginResponse';
import { UserRole } from 'src/common/enums/userRole.enum';
import { Roles } from './decorator/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User } from './user.entity';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	// 일반 사용자 회원가입
	@Post('register')
	async register(@Body() registerRequest: RegisterRequest) {
		return this.authService.registerUser(registerRequest);
	}

	// 관리자 회원가입 (보호 필요)
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@Post('register/admin')
	async registerAdmin(@Body() registerRequest: RegisterRequest) {
		return this.authService.registerAdmin(registerRequest);
	}

	// 로그인
	@Post('login')
	async login(@Body() loginRequest: LoginRequest): Promise<LoginResponse> {
		return this.authService.login(loginRequest);
	}

	// refresh token 재발급
	@Post('refresh')
	async refresh(
		@Body('refreshToken') refreshToken: string,
	): Promise<LoginResponse> {
		return this.authService.refreshToken(refreshToken);
	}

	// 로그아웃
	@UseGuards(JwtAuthGuard)
	@Post('logout')
	async logout(@Req() req: Request & { user: User }) {
		return this.authService.logout(req.user.id);
	}
}
