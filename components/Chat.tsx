"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import DeveloperCard from "@/components/DeveloperCard";
import { MAX_INPUT_CHARS, SUGGESTIONS } from "@/lib/config";

type Msg = { role: "user" | "assistant"; content: string };
type Conv = { id: string; title: string };

const icon = "h-5 w-5";
const Svg = ({ d, className = icon }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);
const PATHS = {
  menu: "M4 6h16M4 12h16M4 18h16",
  plus: "M12 5v14M5 12h14",
  send: "M12 19V5M5 12l7-7 7 7",
  stop: "M7 7h10v10H7z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3",
  copy: "M9 9h10v10H9zM5 15V5h10",
  close: "M6 6l12 12M18 6L6 18",
};

export default function Chat() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false); // mobile sidebar
  const [copied, setCopied] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  async function loadList() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) setConvs((await res.json()).items);
    } catch {
      /* the sidebar is a nicety, never block chatting on it */
    }
  }
  useEffect(() => {
    loadList();
  }, []);

  // Keep the newest text in view while streaming.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Auto-grow the composer up to a limit.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  function newChat() {
    abort.current?.abort();
    setActiveId(null);
    setMessages([]);
    setError("");
    setInput("");
    setOpen(false);
    box.current?.focus();
  }

  async function openChat(id: string) {
    abort.current?.abort();
    setOpen(false);
    setError("");
    setActiveId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error();
      setMessages((await res.json()).messages);
    } catch {
      setError("Couldn't load this chat.");
    }
  }

  async function removeChat(id: string) {
    if (!window.confirm("Delete this chat?")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    if (id === activeId) newChat();
    loadList();
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy || message.length > MAX_INPUT_CHARS) return;

    const ctrl = new AbortController();
    abort.current = ctrl;
    setInput("");
    setError("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      const id = res.headers.get("x-conversation-id");
      if (id) setActiveId(id);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(/fetch|network/i.test((e as Error).message) ? "Connection lost. Please try again." : (e as Error).message);
      }
      // Drop an empty placeholder; keep any partial answer the user already saw.
      setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
    } finally {
      setBusy(false);
      abort.current = null;
      loadList();
    }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard can be blocked; the text is still selectable */
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh overflow-hidden bg-bg text-fg">
      {/* Sidebar (drawer on mobile) */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-panel transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Chats"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accentfg">C</span>
            Clearly
          </span>
          <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-bubble md:hidden" aria-label="Close menu">
            <Svg d={PATHS.close} />
          </button>
        </div>

        <div className="px-3 py-2">
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-medium transition hover:bg-bubble"
          >
            <Svg d={PATHS.plus} className="h-4 w-4" /> New chat
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {convs.length > 0 && <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted">Recent</p>}
          <ul className="space-y-0.5">
            {convs.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  onClick={() => openChat(c.id)}
                  aria-current={c.id === activeId ? "page" : undefined}
                  className={`block w-full truncate rounded-lg px-3 py-2 pe-9 text-start text-sm transition ${
                    c.id === activeId ? "bg-bubble font-medium" : "text-fg/80 hover:bg-bubble"
                  }`}
                >
                  {c.title}
                </button>
                <button
                  onClick={() => removeChat(c.id)}
                  aria-label={`Delete ${c.title}`}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Svg d={PATHS.trash} className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {convs.length === 0 && <p className="px-2 pt-4 text-sm text-muted">Your chats will appear here.</p>}
        </nav>

        <p className="px-4 pb-3 text-xs text-muted">Chats are saved for this browser only.</p>
        <DeveloperCard variant="card" />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 md:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-bubble" aria-label="Open menu">
            <Svg d={PATHS.menu} />
          </button>
          <span className="font-semibold">Clearly</span>
          <button onClick={newChat} className="ms-auto rounded-lg p-2 hover:bg-bubble" aria-label="New chat">
            <Svg d={PATHS.plus} />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
            {empty ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-xl font-bold text-accentfg">C</span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">How can I help today?</h1>
                <p className="mt-2 max-w-md text-muted">Write, rewrite, summarize or brainstorm. Ask anything.</p>
                <ul className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s.title}>
                      <button
                        onClick={() => {
                          setInput(s.prompt);
                          box.current?.focus();
                        }}
                        className="w-full rounded-2xl border border-line bg-bg p-4 text-start transition hover:bg-panel"
                      >
                        <span className="block font-medium">{s.title}</span>
                        <span className="mt-1 line-clamp-1 block text-sm text-muted">{s.prompt.trim()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <DeveloperCard variant="badge" />
              </div>
            ) : (
              <ul className="space-y-6" aria-live="polite">
                {messages.map((m, i) => (
                  <li key={i}>
                    {m.role === "user" ? (
                      <div className="flex justify-end">
                        <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-bubble px-4 py-2.5 leading-relaxed">{m.content}</p>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accentfg">C</span>
                        <div className="min-w-0 flex-1">
                          {m.content ? (
                            <div className="md">
                              <ReactMarkdown
                                components={{
                                  a: ({ children, href }) => (
                                    <a href={href} target="_blank" rel="noopener noreferrer">
                                      {children}
                                    </a>
                                  ),
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="flex gap-1.5 py-2" aria-label="Thinking">
                              {[0, 150, 300].map((d) => (
                                <span key={d} className="h-2 w-2 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                              ))}
                            </div>
                          )}
                          {m.content && !(busy && i === messages.length - 1) && (
                            <button
                              onClick={() => copy(m.content, i)}
                              className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-bubble hover:text-fg"
                            >
                              <Svg d={PATHS.copy} className="h-3.5 w-3.5" /> {copied === i ? "Copied" : "Copy"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div ref={bottom} />
          </div>
        </main>

        {/* Composer */}
        <div className="px-4 pb-4 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {error && (
              <p role="alert" className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2 rounded-3xl border border-line bg-bg p-2 shadow-sm">
              <label htmlFor="message" className="sr-only">Message</label>
              <textarea
                id="message"
                ref={box}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message Clearly…"
                rows={1}
                className="max-h-52 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-relaxed outline-none placeholder:text-muted"
              />
              {busy ? (
                <button onClick={() => abort.current?.abort()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg text-bg" aria-label="Stop">
                  <Svg d={PATHS.stop} className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || input.length > MAX_INPUT_CHARS}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accentfg transition disabled:opacity-30"
                  aria-label="Send"
                >
                  <Svg d={PATHS.send} />
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              {input.length > MAX_INPUT_CHARS - 500
                ? `${input.length} / ${MAX_INPUT_CHARS}`
                : "AI can make mistakes. Please don’t share sensitive information."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}