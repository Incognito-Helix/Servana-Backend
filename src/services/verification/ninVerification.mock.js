// Mock NIN verification provider for development and testing only.
// This does not contact NIMC or verify a real person's identity.
//
// Demo rule:
// - NINs ending in "0000" fail.
// - Other valid 11-digit NINs pass.
// The input format must be validated before calling this provider.

export const verifyNinWithMock = async (nin) => {
  if (nin.endsWith("0000")) {
    return {
      status: "failed",
      failedReason: "Mock verification failed.",
    };
  }

  return {
    status: "passed",
    failedReason: null,
  };
};
