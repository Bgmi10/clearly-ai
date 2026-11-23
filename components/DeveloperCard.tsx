"use client";
import { useRef, useState } from "react";
import { DEVELOPER as D } from "@/lib/config";

function Avatar({ size }: { size: string }) {
  const [failed, setFailed] = useState(false);
  const initials = D.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (failed) {
    return <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-accent font-semibold text-accentfg`}>{initials}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={D.photo} alt={D.name} onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full object-cover`} />;
}

// variant "card": sidebar footer. variant "badge": centred pill on the welcome screen.
export default function DeveloperCard({ variant }: { variant: "card" | "badge" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const links = [
    D.whatsapp && { label: "WhatsApp", href: `https://wa.me/${D.whatsapp}` },
    D.email && { label: "Email", href: `mailto:${D.email}` },
    D.website && { label: "Portfolio", href: D.website },
    D.github && { label: "GitHub", href: D.github },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <>
      {variant === "card" ? (
        <button
          onClick={() => dialog.current?.showModal()}
          className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-start transition hover:bg-bubble"
        >
          <Avatar size="h-9 w-9" />
          <span className="min-w-0">
            <span className="block text-xs text-muted">Built by</span>
            <span className="block truncate text-sm font-medium">{D.name}</span>
          </span>
        </button>
      ) : (
        <button
          onClick={() => dialog.current?.showModal()}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-bg py-1.5 pe-4 ps-1.5 text-sm transition hover:bg-panel"
        >
          <Avatar size="h-7 w-7" />
          <span className="text-muted">Built by</span>
          <span className="font-medium">{D.name}</span>
        </button>
      )}

      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-line bg-bg p-0 text-fg backdrop:bg-black/50"
      >
        <div className="flex flex-col items-center p-8 text-center">
          <Avatar size="h-24 w-24" />
          <h2 className="mt-4 text-xl font-semibold">{D.name}</h2>
          <p className="text-sm text-accent">{D.role}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">{D.bio}</p>
          <ul className="mt-6 grid w-full grid-cols-2 gap-2">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-line px-3 py-2.5 text-sm font-medium transition hover:bg-panel"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <button onClick={() => dialog.current?.close()} className="mt-5 text-sm text-muted hover:text-fg">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}