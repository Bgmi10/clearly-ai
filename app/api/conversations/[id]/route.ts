import { prisma } from "@/lib/db";
import { readSid } from "@/lib/identity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const sid = await readSid();
  if (!sid) return Response.json({ error: "Not found." }, { status: 404 });
  const conv = await prisma.conversation.findFirst({
    where: { id, sid },
    select: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
  });
  if (!conv) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ messages: conv.messages });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const sid = await readSid();
  if (!sid) return Response.json({ ok: true });
  await prisma.conversation.deleteMany({ where: { id, sid } }); // messages cascade
  return Response.json({ ok: true });
}