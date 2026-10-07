import { PrismaClient } from "@prisma/client";

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

const main = async () => {
	for (const zone of zones) {
		await prisma.zone.upsert({
			where: { slug: zone.slug },
			update: zone,
			create: zone,
		});
	}

	console.log(`seeded successfully`)

	// await prisma.category.upsert({
	// 	where: {},
	// 	update: {},
	// 	create: {},
	// });
};

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
