import prisma from "../config/prisma.js";
import { BOOST_BASE_PRICES_KOBO } from "./boost.service.js";

const TYPES = ["zone_boost", "top_spot"];
const DURATIONS = ["daily", "weekly", "monthly"];

const toPrice = (row) => ({
  type: row.type,
  durationType: row.durationType,
  priceKobo: row.priceKobo,
  priceNaira: row.priceKobo / 100,
  updatedAt: row.updatedAt,
});

// The six base prices, in a fixed order so the admin table never jumps.
// A price the admin never changed shows the default, with updatedAt null.
export const listBoostPrices = async () => {
  const rows = await prisma.boostPrice.findMany();

  return TYPES.flatMap((type) =>
    DURATIONS.map((durationType) => {
      const row = rows.find(
        (item) => item.type === type && item.durationType === durationType,
      );

      return toPrice(
        row ?? {
          type,
          durationType,
          priceKobo: BOOST_BASE_PRICES_KOBO[type][durationType],
          updatedAt: null,
        },
      );
    }),
  );
};

// New quotes use the new price straight away. Boosts already bought keep the
// amount they were charged, because that lives on their payment.
export const updateBoostPrice = async ({ type, durationType, priceKobo }) => {
  const row = await prisma.boostPrice.upsert({
    where: { type_durationType: { type, durationType } },
    update: { priceKobo },
    create: { type, durationType, priceKobo },
  });

  return toPrice(row);
};
