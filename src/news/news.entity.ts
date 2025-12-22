import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('news')
export class News {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ nullable: true })
	title: string;

	@Column({ nullable: true })
	url: string;

	@Column({ type: 'text', nullable: true })
	content: string;

	@Column({ type: 'text', nullable: true })
	summary: string;

	@Column({ nullable: true })
	sentiment: string; // positive / neutral / negative

	@Column({ type: 'float', nullable: true })
	score: number;

	@Column('text', { array: true, nullable: true })
	keywords: string[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
