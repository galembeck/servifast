import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@repo/env";
import { hash } from "bcryptjs";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = `${env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
	await prisma.restaurant.deleteMany();
	await prisma.user.deleteMany();

	const passwordHash = await hash("123456", 1);

	const user = await prisma.user.create({
		data: {
			name: "Jhon Doe",
			email: "jhon@acme.com",
			cpf: "52998224725",
			avatarUrl: faker.image.avatar(),
			passwordHash,
		},
	});

	const anotherUser = await prisma.user.create({
		data: {
			name: faker.person.fullName(),
			email: faker.internet.email(),
			avatarUrl: faker.image.avatar(),
			passwordHash,
		},
	});

	const anotherUser2 = await prisma.user.create({
		data: {
			name: faker.person.fullName(),
			email: faker.internet.email(),
			avatarUrl: faker.image.avatar(),
			passwordHash,
		},
	});

	await prisma.restaurant.create({
		data: {
			name: "Acme Inc (Admin)",
			domain: "acme.com",
			slug: "acme-admin",
			avatarUrl: faker.image.avatar(),
			shouldAttachUsersByDomain: true,
			ownerId: user.id,
			projects: {
				createMany: {
					data: [
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
					],
				},
			},
			members: {
				createMany: {
					data: [
						{
							userId: user.id,
							role: "OWNER",
						},
						{
							userId: anotherUser.id,
							role: "WAITER",
						},
						{
							userId: anotherUser2.id,
							role: "KITCHEN",
						},
					],
				},
			},
		},
	});

	await prisma.restaurant.create({
		data: {
			name: "Acme Inc (Member)",
			slug: "acme-member",
			avatarUrl: faker.image.avatar(),
			ownerId: user.id,
			projects: {
				createMany: {
					data: [
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
					],
				},
			},
			members: {
				createMany: {
					data: [
						{
							userId: user.id,
							role: "WAITER",
						},
						{
							userId: anotherUser.id,
							role: "MANAGER",
						},
						{
							userId: anotherUser2.id,
							role: "CASHIER",
						},
					],
				},
			},
		},
	});

	await prisma.restaurant.create({
		data: {
			name: "Acme Inc (Billing)",
			slug: "acme-billing",
			avatarUrl: faker.image.avatar(),
			ownerId: user.id,
			projects: {
				createMany: {
					data: [
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
						{
							name: faker.lorem.words(5),
							slug: faker.lorem.slug(5),
							description: faker.lorem.paragraph(),
							avatarUrl: faker.image.avatar(),
							ownerId: faker.helpers.arrayElement([
								user.id,
								anotherUser.id,
								anotherUser2.id,
							]),
						},
					],
				},
			},
			members: {
				createMany: {
					data: [
						{
							userId: user.id,
							role: "BILLING",
						},
						{
							userId: anotherUser.id,
							role: "OWNER",
						},
						{
							userId: anotherUser2.id,
							role: "WAITER",
						},
					],
				},
			},
		},
	});
}

seed().then(() => {
	console.log("🌿 | Database seeded successfully.");
});
