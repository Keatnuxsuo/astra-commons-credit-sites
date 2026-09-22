import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astra Commons · Perth",
  description: "A constellation of curious minds. Claim your API and Codex credits at Astra Commons Perth, 19 September 2026.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
