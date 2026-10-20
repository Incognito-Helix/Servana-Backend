import {
  suggestLocations,
  saveRecentLocation,
} from "../services/location.service.js";

export const suggestLocationsController = async (req, res, next) => {
  try {
    // req.user is only there when the caller sent a valid token.
    const data = await suggestLocations(req.validatedQuery, req.user?.id);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const saveRecentLocationController = async (req, res, next) => {
  try {
    const zone = await saveRecentLocation(req.user.id, req.body.zoneId);

    return res.status(200).json({
      success: true,
      message: "Location saved.",
      data: { zone },
    });
  } catch (error) {
    return next(error);
  }
};
