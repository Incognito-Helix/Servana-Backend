import prisma from "../config/prisma";

export const logout = (_req, res) => {
  res.status(200).json({ success: true, message: "Logged out" });
};

export const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
      },
    });

    if (!user || user.status === "suspended") {
      const error = new Error("Authentication required.");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
