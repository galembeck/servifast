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

const DEMO_PASSWORD = "servifast123";
const MINUTE_IN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * MINUTE_IN_MS;

function minutesAgo(minutes: number) {
	return new Date(Date.now() - minutes * MINUTE_IN_MS);
}

function daysAgo(days: number) {
	return new Date(Date.now() - days * DAY_IN_MS);
}

const demoStaff = [
	{
		name: "Mariana Costa",
		email: "dono@servifast.com",
		cpf: "12345678062",
		role: "OWNER",
	},
	{
		name: "Rafael Almeida",
		email: "gerente@servifast.com",
		cpf: "23456789173",
		role: "MANAGER",
	},
	{
		name: "Lucas Pereira",
		email: "garcom@servifast.com",
		cpf: "34567891228",
		role: "WAITER",
	},
	{
		name: "Camila Rodrigues",
		email: "caixa@servifast.com",
		cpf: "45678912364",
		role: "CASHIER",
	},
	{
		name: "Bruno Martins",
		email: "cozinha@servifast.com",
		cpf: "56789123482",
		role: "KITCHEN",
	},
	{
		name: "Fernanda Lima",
		email: "financeiro@servifast.com",
		cpf: "67891234582",
		role: "BILLING",
	},
] as const;

const demoMenu: Record<
	string,
	{ name: string; description: string; priceInCents: number }[]
> = {
	Entradas: [
		{
			name: "Bruschetta de Tomate",
			description: "Pão italiano, tomate, manjericão e azeite",
			priceInCents: 2890,
		},
		{
			name: "Bolinho de Bacalhau",
			description: "6 unidades com maionese de ervas",
			priceInCents: 3990,
		},
		{
			name: "Carpaccio",
			description: "Lâminas de filé, alcaparras, parmesão e rúcula",
			priceInCents: 4590,
		},
	],
	"Pratos Principais": [
		{
			name: "Filé à Parmegiana",
			description: "Acompanha arroz e batata frita",
			priceInCents: 6990,
		},
		{
			name: "Salmão Grelhado",
			description: "Com legumes salteados e purê de mandioquinha",
			priceInCents: 7890,
		},
		{
			name: "Picanha na Chapa",
			description: "400g, farofa, vinagrete e arroz",
			priceInCents: 8990,
		},
		{
			name: "Risoto de Cogumelos",
			description: "Arroz arbóreo, shiitake, shimeji e parmesão",
			priceInCents: 5990,
		},
	],
	Massas: [
		{
			name: "Spaghetti à Carbonara",
			description: "Bacon, gema, pecorino e pimenta-do-reino",
			priceInCents: 5290,
		},
		{
			name: "Lasanha à Bolonhesa",
			description: "Molho de carne, presunto e queijo gratinado",
			priceInCents: 5490,
		},
		{
			name: "Nhoque ao Sugo",
			description: "Nhoque de batata com molho de tomate fresco",
			priceInCents: 4690,
		},
	],
	Sobremesas: [
		{
			name: "Petit Gâteau",
			description: "Com sorvete de creme",
			priceInCents: 2890,
		},
		{
			name: "Pudim de Leite",
			description: "Receita da casa",
			priceInCents: 1890,
		},
		{
			name: "Tiramisù",
			description: "Mascarpone, café e cacau",
			priceInCents: 2690,
		},
	],
	Bebidas: [
		{
			name: "Refrigerante Lata",
			description: "350ml",
			priceInCents: 790,
		},
		{
			name: "Suco Natural",
			description: "Laranja, limão, abacaxi ou maracujá — 500ml",
			priceInCents: 1290,
		},
		{
			name: "Água Mineral",
			description: "500ml, com ou sem gás",
			priceInCents: 590,
		},
		{
			name: "Chopp",
			description: "300ml",
			priceInCents: 1490,
		},
		{
			name: "Taça de Vinho Tinto",
			description: "Cabernet Sauvignon",
			priceInCents: 2990,
		},
	],
};

const demoTables = [
	{ number: 1, seatsCount: 2, positionReference: "Janela" },
	{ number: 2, seatsCount: 2, positionReference: "Janela" },
	{ number: 3, seatsCount: 4, positionReference: "Salão principal" },
	{ number: 4, seatsCount: 4, positionReference: "Salão principal" },
	{ number: 5, seatsCount: 4, positionReference: "Salão principal" },
	{ number: 6, seatsCount: 6, positionReference: "Salão principal" },
	{ number: 7, seatsCount: 4, positionReference: "Varanda" },
	{ number: 8, seatsCount: 4, positionReference: "Varanda" },
	{
		number: 9,
		seatsCount: 8,
		positionReference: "Área reservada",
		observations: "Mesa para grupos e aniversários",
	},
	{ number: 10, seatsCount: 2, positionReference: "Balcão" },
	{ number: 11, seatsCount: 4, positionReference: "Varanda" },
	{
		number: 12,
		seatsCount: 6,
		positionReference: "Área reservada",
		observations: "Próxima ao playground",
	},
];

interface DemoTabItem {
	cancelled?: boolean;
	menuItem: string;
	notes?: string;
	quantity: number;
	sent?: boolean;
}

interface DemoOpenTab {
	customerName: string;
	items: DemoTabItem[];
	openedMinutesAgo: number;
	peopleCount: number;
	status: "OCCUPIED" | "BILL_REQUESTED";
	tableNumber: number;
}

const demoOpenTabs: DemoOpenTab[] = [
	{
		tableNumber: 3,
		status: "OCCUPIED",
		customerName: "Família Souza",
		peopleCount: 4,
		openedMinutesAgo: 45,
		items: [
			{ menuItem: "Bolinho de Bacalhau", quantity: 1, sent: true },
			{
				menuItem: "Filé à Parmegiana",
				quantity: 2,
				notes: "Um sem batata frita",
				sent: true,
			},
			{ menuItem: "Lasanha à Bolonhesa", quantity: 1, sent: true },
			{ menuItem: "Refrigerante Lata", quantity: 3, sent: true },
			{ menuItem: "Petit Gâteau", quantity: 2 },
		],
	},
	{
		tableNumber: 1,
		status: "OCCUPIED",
		customerName: "Ana e Pedro",
		peopleCount: 2,
		openedMinutesAgo: 20,
		items: [
			{ menuItem: "Carpaccio", quantity: 1, sent: true },
			{ menuItem: "Taça de Vinho Tinto", quantity: 2, sent: true },
			{
				menuItem: "Risoto de Cogumelos",
				quantity: 1,
				notes: "Sem parmesão",
			},
			{ menuItem: "Salmão Grelhado", quantity: 1 },
		],
	},
	{
		tableNumber: 6,
		status: "OCCUPIED",
		customerName: "Carlos",
		peopleCount: 5,
		openedMinutesAgo: 10,
		items: [
			{ menuItem: "Chopp", quantity: 4, sent: true },
			{
				menuItem: "Picanha na Chapa",
				quantity: 2,
				notes: "Ao ponto",
			},
			{ menuItem: "Suco Natural", quantity: 1, notes: "Maracujá" },
			{ menuItem: "Água Mineral", quantity: 1, cancelled: true },
		],
	},
	{
		tableNumber: 8,
		status: "BILL_REQUESTED",
		customerName: "Juliana",
		peopleCount: 3,
		openedMinutesAgo: 90,
		items: [
			{ menuItem: "Bruschetta de Tomate", quantity: 1, sent: true },
			{ menuItem: "Spaghetti à Carbonara", quantity: 2, sent: true },
			{ menuItem: "Nhoque ao Sugo", quantity: 1, sent: true },
			{ menuItem: "Suco Natural", quantity: 3, notes: "Laranja", sent: true },
			{ menuItem: "Tiramisù", quantity: 2, sent: true },
		],
	},
	{
		tableNumber: 9,
		status: "OCCUPIED",
		customerName: "Aniversário da Bia",
		peopleCount: 8,
		openedMinutesAgo: 60,
		items: [
			{ menuItem: "Bolinho de Bacalhau", quantity: 2, sent: true },
			{ menuItem: "Bruschetta de Tomate", quantity: 2, sent: true },
			{ menuItem: "Chopp", quantity: 6, sent: true },
			{ menuItem: "Refrigerante Lata", quantity: 2, sent: true },
			{ menuItem: "Picanha na Chapa", quantity: 2, sent: true },
			{ menuItem: "Lasanha à Bolonhesa", quantity: 2, sent: true },
			{
				menuItem: "Pudim de Leite",
				quantity: 8,
				notes: "Trazer junto com o bolo",
			},
		],
	},
];

const demoExpenses = [
	{ category: "Fornecedores", amountInCents: 485_000, days: 2 },
	{ category: "Hortifruti", amountInCents: 92_300, days: 3 },
	{ category: "Bebidas", amountInCents: 156_000, days: 5 },
	{ category: "Energia elétrica", amountInCents: 238_900, days: 8 },
	{ category: "Água", amountInCents: 64_500, days: 8 },
	{ category: "Gás", amountInCents: 41_000, days: 10 },
	{ category: "Manutenção", amountInCents: 35_000, days: 14 },
	{ category: "Aluguel", amountInCents: 1_200_000, days: 20 },
	{ category: "Fornecedores", amountInCents: 512_000, days: 22 },
	{ category: "Marketing", amountInCents: 80_000, days: 25 },
];

type MenuItemsByName = Map<string, { id: string; price: number }>;

async function seedDemoMenu(restaurantId: string): Promise<MenuItemsByName> {
	const menuItemsByName: MenuItemsByName = new Map();

	for (const [categoryName, items] of Object.entries(demoMenu)) {
		const category = await prisma.menuCategory.create({
			data: { name: categoryName, restaurantId },
		});

		for (const item of items) {
			const menuItem = await prisma.menuItem.create({
				data: { ...item, restaurantId, categoryId: category.id },
			});

			menuItemsByName.set(item.name, {
				id: menuItem.id,
				price: menuItem.priceInCents,
			});
		}
	}

	await prisma.menuItem.updateMany({
		where: { restaurantId, name: "Carpaccio" },
		data: { isAvailable: false },
	});

	return menuItemsByName;
}

async function seedDemoTables(restaurantId: string) {
	const tablesByNumber = new Map<number, string>();

	for (const table of demoTables) {
		const created = await prisma.table.create({
			data: { ...table, restaurantId },
		});

		tablesByNumber.set(table.number, created.id);
	}

	return tablesByNumber;
}

async function seedDemoOpenTab(
	restaurantId: string,
	openTab: DemoOpenTab,
	tablesByNumber: Map<number, string>,
	menuItemsByName: MenuItemsByName
) {
	const tableId = tablesByNumber.get(openTab.tableNumber);

	if (!tableId) {
		throw new Error(`Demo table ${openTab.tableNumber} not found.`);
	}

	const openedAt = minutesAgo(openTab.openedMinutesAgo);
	const sentAt = minutesAgo(openTab.openedMinutesAgo - 5);

	await prisma.table.update({
		where: { id: tableId },
		data: { status: openTab.status, occupiedSeats: openTab.peopleCount },
	});

	const tab = await prisma.tab.create({
		data: {
			customerName: openTab.customerName,
			peopleCount: openTab.peopleCount,
			openedAt,
			tableId,
			restaurantId,
		},
	});

	const sentSnapshot: {
		id: string;
		productId: string;
		name: string;
		quantity: number;
		notes: string | null;
	}[] = [];

	for (const item of openTab.items) {
		const menuItem = menuItemsByName.get(item.menuItem);

		if (!menuItem) {
			throw new Error(`Demo menu item "${item.menuItem}" not found.`);
		}

		const orderItem = await prisma.orderItem.create({
			data: {
				quantity: item.quantity,
				notes: item.notes ?? null,
				status: item.cancelled ? "CANCELLED" : "RECEIVED",
				unitPriceInCents: menuItem.price,
				sentToKitchenAt: item.sent ? sentAt : null,
				createdAt: openedAt,
				tabId: tab.id,
				menuItemId: menuItem.id,
				restaurantId,
			},
		});

		if (item.sent) {
			sentSnapshot.push({
				id: orderItem.id,
				productId: menuItem.id,
				name: item.menuItem,
				quantity: item.quantity,
				notes: item.notes ?? null,
			});
		}
	}

	if (sentSnapshot.length > 0) {
		await prisma.kdsEvent.create({
			data: { sentAt, items: sentSnapshot, tabId: tab.id, restaurantId },
		});
	}
}

async function seedDemoRestaurant() {
	const passwordHash = await hash(DEMO_PASSWORD, 1);

	const staff = await Promise.all(
		demoStaff.map(async (member) => {
			const user = await prisma.user.create({
				data: {
					name: member.name,
					email: member.email,
					cpf: member.cpf,
					avatarUrl: faker.image.avatar(),
					passwordHash,
				},
			});

			return { user, role: member.role };
		})
	);

	const owner = staff.find((member) => member.role === "OWNER");

	if (!owner) {
		throw new Error("Demo staff must include an OWNER.");
	}

	const restaurant = await prisma.restaurant.create({
		data: {
			name: "Cantina Bella Vista",
			slug: "cantina-bella-vista",
			avatarUrl: faker.image.avatar(),
			ownerId: owner.user.id,
			members: {
				createMany: {
					data: staff.map(({ user, role }) => ({ userId: user.id, role })),
				},
			},
		},
	});

	const menuItemsByName = await seedDemoMenu(restaurant.id);
	const tablesByNumber = await seedDemoTables(restaurant.id);

	for (const openTab of demoOpenTabs) {
		await seedDemoOpenTab(
			restaurant.id,
			openTab,
			tablesByNumber,
			menuItemsByName
		);
	}

	await prisma.expense.createMany({
		data: demoExpenses.map(({ days, ...expense }) => ({
			...expense,
			occurredAt: daysAgo(days),
			restaurantId: restaurant.id,
		})),
	});
}

seed()
	.then(seedDemoRestaurant)
	.then(() => {
		console.log("🌿 | Database seeded successfully.");
	});
