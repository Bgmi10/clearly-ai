import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Only returns the visitor's own recent results (scoped by cookie).
export async function GET() {
  const sid = (await cookies()).get("sid")?.value;
  if (!sid) return Response.json({ items: [] });
  const items = await prisma.generation.findMany({
    where: { sid },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, mode: true, tone: true, input: true, output: true, cached: true, createdAt: true },
  });
  return Response.json({ items });
}
