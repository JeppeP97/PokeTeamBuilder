import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pokémon AI Team Builder",
  description:
    "Byg et Gen 3-hold til FireRed eller Emerald og få en AI-coachet analyse med konkrete erstatningsforslag.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="da" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
