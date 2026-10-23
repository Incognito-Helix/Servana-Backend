import {
  revealContact,
  recordContactTap,
} from "../services/contact.service.js";

export const revealContactController = async (req, res, next) => {
  try {
    const contact = await revealContact(req.user.id, req.params.id);

    return res.status(200).json({
      success: true,
      data: { contact },
    });
  } catch (error) {
    return next(error);
  }
};

export const contactTapController = async (req, res, next) => {
  try {
    await recordContactTap(req.user.id, req.params.id);

    return res.status(201).json({
      success: true,
      message: "Contact tap recorded.",
    });
  } catch (error) {
    return next(error);
  }
};
