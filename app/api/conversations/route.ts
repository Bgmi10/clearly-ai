import { prisma } from "@/lib/db";
import { readSid } from "@/lib/identity";

export const runtime = "nodejs";

// The visitor's own chats, newest first.
export async function GET() {
  const sid = await readSid();
  if (!sid) return Response.json({ items: [] });
  const items = await prisma.conversation.findMany({
    where: { sid },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true },
  });
  return Response.json({ items });
}