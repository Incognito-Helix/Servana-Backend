import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const zones = [
	{
		state: "Lagos",
		city: "Lagos",
		name: "Lekki",
		slug: "lekki",
		centerLatitude: 6.4474,
		centerLongitude: 3.4723,
		boostPriceMultiplier: 1.5,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Victoria Island",
		slug: "victoria-island",
		centerLatitude: 6.4281,
		centerLongitude: 3.4219,
		boostPriceMultiplier: 1.5,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Ikoyi",
		slug: "ikoyi",
		centerLatitude: 6.4549,
		centerLongitude: 3.4366,
		boostPriceMultiplier: 1.5,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Ikeja",
		slug: "ikeja",
		centerLatitude: 6.6018,
		centerLongitude: 3.3515,
		boostPriceMultiplier: 1.0,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Yaba",
		slug: "yaba",
		centerLatitude: 6.5095,
		centerLongitude: 3.3711,
		boostPriceMultiplier: 1.0,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Surulere",
		slug: "surulere",
		centerLatitude: 6.4969,
		centerLongitude: 3.3503,
		boostPriceMultiplier: 1.0,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Ajah",
		slug: "ajah",
		centerLatitude: 6.4698,
		centerLongitude: 3.5852,
		boostPriceMultiplier: 1.0,
	},
	{
		state: "Lagos",
		city: "Lagos",
		name: "Ikorodu",
		slug: "ikorodu",
		centerLatitude: 6.6194,
		centerLongitude: 3.5105,
		boostPriceMultiplier: 1.0,
	},
];

const categories = [
	{
		name: "Beauty",
		slug: "beauty",
		children: [
			{ name: "Hair", slug: "hair" },
			{ name: "Makeup", slug: "makeup" },
			{ name: "Nails", slug: "nails" },
			{ name: "Lashes", slug: "lashes" },
			{ name: "Barbing", slug: "barbing" },
		],
	},

	{
		name: "Events",
		slug: "events",
		children: [
			{ name: "Event planning", slug: "event-planning" },
			{ name: "Decoration", slug: "decoration" },
			{ name: "DJs", slug: "djs" },
			{ name: "MCs", slug: "mcs" },
			{ name: "Rentals", slug: "rentals" },
		],
	},

	{
		name: "Food",
		slug: "food",
		children: [
			{ name: "Catering", slug: "catering" },
			{ name: "Small chops", slug: "small-chops" },
			{ name: "Cakes", slug: "cakes" },
		],
	},

	{
		name: "Home",
		slug: "home",
		children: [
			{ name: "Cleaning", slug: "cleaning" },
			{ name: "Laundry", slug: "laundry" },
		],
	},
	{
		name: "Tech and creative",
		slug: "tech-and-creative",

		children: [
			{ name: "Design", slug: "design" },
			{ name: "Writing", slug: "writing" },
			{ name: "Photography", slug: "photography" },
			{ name: "Tutoring", slug: "tutoring" },
			{ name: "Content creation", slug: "content-creation" },
			{ name: "Tech", slug: "tech" },
		],
	},
];

const main = async () => {
	for (const zone of zones) {
		await prisma.zone.upsert({
			where: { slug: zone.slug },
			update: zone,
			create: zone,
		});
	}

	console.log(`seeded successfully`);

	for (const category of categories) {
		const { children, ...parentdData } = category;

		const parent = await prisma.category.upsert({
			where: { slug: parentdData.slug },
			update: parentdData,
			create: parentdData,
		});

		for (const child of children) {
			await prisma.category.upsert({
				where: { slug: child.slug },
				update: { ...child, parentId: parent.id },
				create: { ...child, parentId: parent.id },
			});
		}
	}
	console.log("seeded category sussessfully");

	const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

	if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
		throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
	}

	const email = ADMIN_EMAIL.toLowerCase();
	const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

	await prisma.user.upsert({
		where: { email },
		update: {},
		create: {
			firstName: "Servana",
			lastName: "Admin",
			email,
			passwordHash,
			role: "admin",
			emailVerified: true,
		},
	});

	console.log("seeded admin sussessfully");
};

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
