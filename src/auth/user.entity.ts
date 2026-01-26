// src/auth/user.entity.ts
import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm';
import { UserRole } from 'src/common/enums/userRole.enum';

@Entity('users')
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	email: string;

	@Column()
	password: string; // bcrypt로 해시화

	@Column({ nullable: true })
	name: string;

	@Column({ type: 'enum', enum: UserRole })
	role: UserRole;

	@Column({ type: 'varchar', nullable: true })
	refreshTokenHash?: string | null;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
