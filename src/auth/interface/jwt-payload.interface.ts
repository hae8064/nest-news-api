import { UserRole } from 'src/common/enums/userRole.enum';

export interface JwtPayload {
	sub: number;
	email: string;
	role: UserRole;
}
