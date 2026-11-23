import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { buildSystem, buildUser, getClient, MAX_OUTPUT_TOKENS, MODEL, REASONING_EFFORT } from "@/lib/ai";
import { MAX_INPUT_CHARS, MIN_INPUT_CHARS, MODES, TONES, type ModeId, type Tone } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATE_PER_HOUR = Number(process.env.RATE_PER_HOUR ?? 20);
const DAILY_TOKEN_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET ?? 200_000);

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const fail = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request) {
  // 1. Validate. Never trust the client.
  const body = await req.json().catch(() => null);
  const mode = body?.mode as ModeId;
  const tone = body?.tone as Tone;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!MODES.some((m) => m.id === mode) || !TONES.includes(tone)) return fail("Invalid options.", 400);
  if (text.length < MIN_INPUT_CHARS) return fail("Please enter a little more text.", 400);
  if (text.length > MAX_INPUT_CHARS) return fail(`Please keep it under ${MAX_INPUT_CHARS} characters.`, 400);

  // 2. Identify the visitor without storing anything personal.
  const sid = (await cookies()).get("sid")?.value ?? randomUUID();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ipHash = sha(ip + (process.env.IP_SALT ?? ""));
  const cacheKey = sha(`${mode}|${tone}|${text.replace(/\s+/g, " ")}`);
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Set-Cookie": `sid=${sid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`,
  };

  // 3. Cache: the same request is answered from the database for free.
  const hit = await prisma.generation.findFirst({ where: { cacheKey, cached: false }, select: { output: true } });
  if (hit) {
    await prisma.generation.create({ data: { sid, ipHash, mode, tone, input: text, output: hit.output, cacheKey, cached: true } });
    return new Response(hit.output, { headers: { ...headers, "x-cache": "HIT" } });
  }

  // 4. Guards: per-visitor hourly limit, then a global daily token budget.
  const used = await prisma.generation.count({
    where: { ipHash, cached: false, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (used >= RATE_PER_HOUR) return fail("You've reached the hourly limit. Please try again later.", 429);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { _sum } = await prisma.generation.aggregate({
    _sum: { inputTokens: true, outputTokens: true },
    where: { createdAt: { gte: startOfDay } },
  });
  if ((_sum.inputTokens ?? 0) + (_sum.outputTokens ?? 0) >= DAILY_TOKEN_BUDGET) {
    return fail("The demo has reached its daily usage limit. Please come back tomorrow.", 503);
  }

  // 5. Start the Groq stream. Errors here (busy, bad key) become a clean JSON error.
  const ctrl = new AbortController();
  req.signal.addEventListener("abort", () => ctrl.abort());

  let stream;
  try {
    stream = await getClient().chat.completions.create(
      {
        model: MODEL,
        messages: [
          { role: "system", content: buildSystem(mode, tone) },
          { role: "user", content: buildUser(text) },
        ],
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

  // 6. Forward text to the browser as it arrives, then save the finished result.
  const encoder = new TextEncoder();
  let output = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const responseBody = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            output += delta;
            controller.enqueue(encoder.encode(delta));
          }
          // Groq reports usage on the final chunk.
          const usage = (chunk as { x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } } }).x_groq?.usage;
          if (usage) {
            inputTokens = usage.prompt_tokens ?? 0;
            outputTokens = usage.completion_tokens ?? 0;
          }
        }
        if (!output.trim()) throw new Error("empty response"); // e.g. reasoning used the whole token budget
        await prisma.generation.create({
          data: { sid, ipHash, mode, tone, input: text, output, cacheKey, inputTokens, outputTokens },
        });
        controller.close();
      } catch (err) {
        controller.error(err); // partial or empty output is never cached
      }
    },
  });

  return new Response(responseBody, { headers: { ...headers, "x-cache": "MISS" } });
}