import { prisma } from "@/lib/db";
import { getClient, MAX_OUTPUT_TOKENS, MODEL, REASONING_EFFORT, SYSTEM_PROMPT } from "@/lib/ai";
import { getVisitor } from "@/lib/identity";
import { MAX_CONTEXT_MESSAGES, MAX_INPUT_CHARS, MAX_MESSAGES_PER_CONVERSATION } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_PER_HOUR = Number(process.env.RATE_PER_HOUR ?? 30);
const DAILY_TOKEN_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET ?? 200_000);

const fail = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 48).trimEnd() + "…" : t;
};

type Role = "user" | "assistant";

export async function POST(req: Request) {
  // 1. Validate. Never trust the client.
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  if (!message) return fail("Please type a message.", 400);
  if (message.length > MAX_INPUT_CHARS) return fail(`Please keep messages under ${MAX_INPUT_CHARS} characters.`, 400);

  const visitor = await getVisitor(req);

  // 2. Cost guards: hourly limit per visitor, then a global daily token budget.
  const used = await prisma.message.count({
    where: { ipHash: visitor.ipHash, role: "assistant", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (used >= RATE_PER_HOUR) return fail("You've reached the hourly limit. Please try again later.", 429);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { _sum } = await prisma.message.aggregate({
    _sum: { inputTokens: true, outputTokens: true },
    where: { createdAt: { gte: startOfDay } },
  });
  if ((_sum.inputTokens ?? 0) + (_sum.outputTokens ?? 0) >= DAILY_TOKEN_BUDGET) {
    return fail("The demo has reached its daily usage limit. Please come back tomorrow.", 503);
  }

  // 3. Load only the recent history of this visitor's own conversation.
  let history: { role: Role; content: string }[] = [];
  if (conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, sid: visitor.sid },
      select: { _count: { select: { messages: true } } },
    });
    if (!conv) return fail("Conversation not found.", 404);
    if (conv._count.messages >= MAX_MESSAGES_PER_CONVERSATION) {
      return fail("This chat is getting long. Please start a new chat to continue.", 400);
    }
    const recent = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: MAX_CONTEXT_MESSAGES,
      select: { role: true, content: true },
    });
    history = recent.reverse() as { role: Role; content: string }[];
  }

  // 4. Start the Groq stream. Failures here become a clean JSON error and nothing is saved.
  const ctrl = new AbortController();
  req.signal.addEventListener("abort", () => ctrl.abort());

  let stream;
  try {
    stream = await getClient().chat.completions.create(
      {
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: message }],
        temperature: 0.7,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        top_p: 1,
        reasoning_effort: REASONING_EFFORT,
        stream: true,
      },
      { signal: ctrl.signal },
    );
  } catch (err) {
    const status = (err as { status?: number }).status;
    return fail(
      status === 429
        ? "The AI service is busy right now. Please try again in a moment."
        : "The AI service is unavailable. Please try again.",
      502,
    );
  }

  // 5. Now it is safe to save the user's message (and the chat, if it is new).
  const convId =
    conversationId ?? (await prisma.conversation.create({ data: { sid: visitor.sid, title: titleFrom(message) } })).id;
  await prisma.message.create({ data: { conversationId: convId, role: "user", content: message } });

  // 6. Forward text as it arrives, then save the assistant's reply (also if the user pressed Stop).
  const encoder = new TextEncoder();
  let output = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const responseBody = new ReadableStream({
    async start(controller) {
      let aborted = false;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            output += delta;
            controller.enqueue(encoder.encode(delta));
          }
          const usage = (chunk as { x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } } }).x_groq?.usage;
          if (usage) {
            inputTokens = usage.prompt_tokens ?? 0;
            outputTokens = usage.completion_tokens ?? 0;
          }
        }
      } catch {
        aborted = true;
      }

      if (output.trim()) {
        await prisma.message.create({
          data: { conversationId: convId, role: "assistant", content: output, inputTokens, outputTokens, ipHash: visitor.ipHash },
        });
        await prisma.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
      }

      if (aborted && !output.trim()) controller.error(new Error("empty response"));
      else controller.close();
    },
  });

  return new Response(responseBody, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": visitor.cookie,
      "x-conversation-id": convId,
    },
  });
}