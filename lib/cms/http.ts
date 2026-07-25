import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Some API clients issue HEAD and still call response.json(); include the JSON body. */
export async function headWithJsonBody(response: Response): Promise<Response> {
  const body = await response.clone().text();
  return withAgentCors(
    new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    }),
  );
}

const AGENT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function withAgentCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(AGENT_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function agentJsonOk<T>(data: T, init?: ResponseInit) {
  return withAgentCors(NextResponse.json(data, init));
}

export function agentJsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return agentJsonOk({ error: message, ...extra }, { status });
}
