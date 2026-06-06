import { CognitoJwtVerifier } from "aws-jwt-verify";

let verifier = null;
let idVerifier = null;

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

function getIdVerifier() {
  if (idVerifier) return idVerifier;

  idVerifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse: "id",
    clientId: process.env.COGNITO_CLIENT_ID,
  });

  return idVerifier;
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [, token] = authHeader.match(/^Bearer\s+(.+)$/i) || [];

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = await getVerifier().verify(token);
    const idToken = req.headers["x-cognito-id-token"];
    let identity = null;

    if (idToken) {
      try {
        const idPayload = await getIdVerifier().verify(idToken);
        if (idPayload.sub === payload.sub) identity = idPayload;
      } catch (err) {
        console.warn("Optional Cognito ID token verification failed:", err.message);
      }
    }

    req.user = {
      userId: payload.sub,
      name: identity?.name || "",
      email: identity?.email || payload.email || "",
      groups: Array.isArray(payload["cognito:groups"])
        ? payload["cognito:groups"]
        : [],
    };

    next();
  } catch (err) {
    console.error("Auth token verification failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireDeveloper(req, res, next) {
  if (!req.user?.groups?.includes("developers")) {
    return res.status(403).json({ error: "Developer access required" });
  }

  next();
}
