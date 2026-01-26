import { UserRole } from 'src/common/enums/userRole.enum';

export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	user: {
		email: string;
		name: string;
		role: UserRole;
	};
}
