# Clearly: AI writing assistant

Next.js 15 (App Router), Tailwind CSS 4, Prisma 6, Postgres, Anthropic API.
The visitor pastes text, picks Rewrite / Summarize / Draft a reply and a tone, and the answer streams in.

## Run it

```bash
cp .env.example .env        # add ANTHROPIC_API_KEY
docker compose up -d        # local Postgres (or point DATABASE_URL at Neon/Supabase)
npm install
npx prisma migrate dev --name init
npm run dev                 # http://localhost:3000
```

## Deploy (free tier friendly)

1. Push to GitHub, import into Vercel.
2. Create a free Postgres database (Neon or Supabase) and set `DATABASE_URL`.
3. Add the env vars from `.env.example` in Vercel.
4. Run `npx prisma migrate deploy` once against the production database.

## How costs stay low

| Control | Where | Effect |
|---|---|---|
| Small, fast model | `ANTHROPIC_MODEL` (default `claude-haiku-5-5`) | Lowest price per request that still writes well |
| Output cap | `MAX_OUTPUT_TOKENS` (600) | A request can never run away |
| Input cap | `MAX_INPUT_CHARS` (4000) | Bounds the cost of every call |
| Response cache | `cacheKey` in Postgres | Identical request = answered from the database, zero API cost |
| Per-visitor limit | `RATE_PER_HOUR` (20) | Stops one person draining the budget |
| Daily budget | `DAILY_TOKEN_BUDGET` (200k) | Hard ceiling for the whole site; shows a friendly message when hit |
| One table, no extra services | `Generation` model | History, cache, rate limit and usage ledger in the database you already have |

Every request stores its token counts, so real usage and spend can be checked with one SQL query:

```sql
SELECT date_trunc('day', "createdAt") AS day,
       count(*) FILTER (WHERE NOT cached) AS api_calls,
       count(*) FILTER (WHERE cached)     AS cache_hits,
       sum("inputTokens") AS input_tokens,
       sum("outputTokens") AS output_tokens
FROM "Generation" GROUP BY 1 ORDER BY 1 DESC;
```

## Reliability

- Server validates every field; the browser is never trusted.
- Streaming response with a Stop button; closing the tab cancels the upstream request.
- Partial or failed generations are never cached or billed to the history.
- User text is wrapped in tags and the model is told to treat it as material, not instructions.
- IPs are stored only as salted hashes. History is scoped to the visitor's own cookie.

## Customising the AI feature

The whole behaviour lives in `lib/ai.ts` (prompts) and `lib/config.ts` (modes and tones).
To turn this into a different tool (product descriptions, support replies, meal plans), change those two files.
