import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

const invalidGoogleToken = (message = "Invalid Google sign-in token.") => {
  const error = new Error(message);
  error.status = 401;
  error.code = "INVALID_GOOGLE_TOKEN";
  return error;
};

// Google may omit the family name, so fall back to the full name.
const splitName = (payload) => {
  const parts = (payload.name || "").trim().split(/\s+/).filter(Boolean);

  const firstName = (payload.given_name || parts[0] || "").trim();
  const lastName = (
    payload.family_name ||
    parts.slice(1).join(" ") ||
    "User"
  ).trim();

  return {
    firstName: firstName.slice(0, 50) || "User",
    lastName: lastName.slice(0, 50),
  };
};

// Verifies the Google ID token on the server and returns the profile.
export const verifyGoogleToken = async (idToken) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  let payload;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw invalidGoogleToken();
  }

  if (!payload?.sub || !payload.email) {
    throw invalidGoogleToken();
  }

  if (payload.email_verified !== true) {
    throw invalidGoogleToken("Your Google email is not verified.");
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    ...splitName(payload),
  };
};
