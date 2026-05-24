import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  areLoginCredentialsValid,
  createSessionToken,
  getSessionCookieOptions,
} from "@/lib/auth";

type LoginBody = {
  password?: string;
  username?: string;
};

async function readJson(request: Request) {
  try {
    return (await request.json()) as LoginBody;
  } catch {
    return null;
  }
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const username = body?.username?.trim() ?? "";
    const password = body?.password ?? "";

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    if (!areLoginCredentialsValid(username, password)) {
      return jsonError("Invalid username or password.", 401);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      AUTH_COOKIE_NAME,
      createSessionToken(username),
      getSessionCookieOptions(),
    );

    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed", error);
    return jsonError("Login is not configured correctly.", 500);
  }
}
