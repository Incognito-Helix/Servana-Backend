import {
  createService,
  getServices,
  updateService,
  deleteService,
} from "../services/vendor.service.js";

export const createVendorService = async (req, res, next) => {
  try {
    const service = await createService(req.params.id, req.body);

    return res.status(201).json({
      success: true,
      message: "Service created.",
      data: { service },
    });
  } catch (error) {
    return next(error);
  }
};

export const getVendorServices = async (req, res, next) => {
  try {
    const services = await getServices(req.params.id);

    return res.status(200).json({
      success: true,
      data: { services },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateVendorService = async (req, res, next) => {
  try {
    const service = await updateService(
      req.params.id,
      req.params.serviceId,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Service updated.",
      data: { service },
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteVendorService = async (req, res, next) => {
  try {
    const result = await deleteService(req.params.id, req.params.serviceId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};
