import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE_NAME = "recall_session";
export const AUTH_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

type SessionPayload = {
  expiresAt: number;
  username: string;
};

function readRequiredEnv(name: "AUTH_USERNAME" | "AUTH_PASSWORD" | "AUTH_SESSION_SECRET") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAuthConfig() {
  return {
    password: readRequiredEnv("AUTH_PASSWORD"),
    secret: readRequiredEnv("AUTH_SESSION_SECRET"),
    username: readRequiredEnv("AUTH_USERNAME"),
  };
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(decoded) as SessionPayload;
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function hasMatchingSignature(signature: string, expectedSignature: string) {
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function areLoginCredentialsValid(username: string, password: string) {
  const config = getAuthConfig();
  return username === config.username && password === config.password;
}

export function createSessionToken(username: string) {
  const { secret, username: allowedUsername } = getAuthConfig();

  if (username !== allowedUsername) {
    throw new Error("Cannot create a session for an unknown username.");
  }

  const payload = encodePayload({
    expiresAt: Date.now() + AUTH_SESSION_DURATION_MS,
    username,
  });
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function isSessionTokenValid(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const { secret, username } = getAuthConfig();
  const expectedSignature = signPayload(encodedPayload, secret);

  if (!hasMatchingSignature(signature, expectedSignature)) {
    return false;
  }

  const payload = decodePayload(encodedPayload);

  if (!payload) {
    return false;
  }

  if (payload.username !== username) {
    return false;
  }

  return payload.expiresAt > Date.now();
}

export function getSessionCookieOptions() {
  return {
    expires: new Date(Date.now() + AUTH_SESSION_DURATION_MS),
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
