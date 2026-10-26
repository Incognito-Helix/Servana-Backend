import Joi from "joi";

const boostFields = {
  categoryId: Joi.string().uuid().required(),
  type: Joi.string().valid("top_spot", "zone_boost").required(),
  durationType: Joi.string().valid("daily", "weekly", "monthly").required(),
  zoneIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(10)
    .unique()
    .required(),
};

export const createBoostSchema = Joi.object({
  profileId: Joi.string().uuid().required(),
  ...boostFields,
});

export const quoteBoostSchema = Joi.object(boostFields);