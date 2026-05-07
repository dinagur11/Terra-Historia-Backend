import { CognitoJwtVerifier } from "aws-jwt-verify";

let verifier = null;

function getVerifier() {
  if (verifier) return verifier;

  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
    throw new Error("Missing Cognito verifier environment variables");
  }

  verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.COGNITO_CLIENT_ID,
  });

  return verifier;
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.match(/^Bearer\s+(.+)$/i) || [];

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = await getVerifier().verify(token);

    req.user = {
      userId: payload.sub,
      email: payload.email || payload.username || "",
    };

    next();
  } catch (err) {
    console.error("Auth token verification failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
