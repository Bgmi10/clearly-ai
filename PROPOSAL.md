Hi,

I build exactly this kind of project: a clean, responsive front end with an AI feature that is connected properly, fast to use and cheap to run.

**What I'd deliver**
- A single-page tool built with Next.js and Tailwind CSS that works on phones, tablets and desktops
- The AI feature connected with streaming, so answers start appearing immediately
- Postgres (via Prisma) for saved history and usage tracking
- Clear error states, loading states and a keyboard-friendly, accessible interface
- Deployed on Vercel with a free-tier database, and a short handover guide

**Live demo (built for this brief)**
[link to the deployed demo]. Paste text, pick a tone, and the result streams in. It has the cost controls described below already built in.

**Similar work**
- Bilingual (English/Arabic) business website for an events and photography company, with a database-backed enquiry form: [link]
- Membership app with online payments and webhook verification (Next.js, Prisma): [link or description, if the client allows]

**How I keep costs low**
1. A small, fast AI model by default, so each request costs a fraction of a cent. The model is one setting, so it can be upgraded later without code changes.
2. Caps on input and output length, so no request can run away.
3. Identical requests are answered from the database instead of calling the AI again.
4. A per-visitor hourly limit and a daily token budget for the whole site, so the bill has a hard ceiling.
5. Free-tier hosting and database to start, with no extra services.
6. Every request logs its token usage, so you can see real costs from day one.

**Questions to confirm scope**
- What should the AI tool do for your users (the demo is a writing assistant, easy to swap)?
- Do you need user accounts, or is anonymous use fine?
- Expected traffic and a monthly AI budget, so I can set the limits.

I can start right away and have a working version for review within a few days.
