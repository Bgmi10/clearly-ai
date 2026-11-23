import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// Anonymous visitor: a random cookie id (scopes chats) and a salted IP hash (rate limits).
export async function getVisitor(req: Request) {
  const sid = (await cookies()).get("sid")?.value ?? randomUUID();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  return {
    sid,
    ipHash: sha(ip + (process.env.IP_SALT ?? "")),
    cookie: `sid=${sid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`,
  };
}

export async function readSid() {
  return (await cookies()).get("sid")?.value ?? null;
}