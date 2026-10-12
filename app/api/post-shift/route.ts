import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://post-shift.ru/api.php";
const ALLOWED_ACTIONS = new Set([
  "reg",
  "verify",
  "getverify",
  "hash",
  "balance",
  "new",
  "getlist",
  "getmail",
  "livetime",
  "update",
  "delete",
  "clear",
  "getkeys",
  "deleteall"
]);

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = typeof payload.action === "string" ? payload.action : "";

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("action", action);

    for (const [key, value] of Object.entries(payload)) {
      if (key === "action" || value === undefined || value === null || value === "") continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent": "Post-Shift-Console/0.1"
      },
      cache: "no-store"
    });

    const raw = await response.text();
    let data: unknown = raw;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    return NextResponse.json(
      {
        ok: response.ok,
        status: response.status,
        data
      },
      { status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "proxy_failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
