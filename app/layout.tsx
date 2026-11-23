import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clearly | AI writing assistant",
  description: "Rewrite, summarize or reply in seconds. Paste your text, pick a tone, get a result.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
