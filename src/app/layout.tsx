import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const ui = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"] });
const copy = Newsreader({ variable: "--font-copy", subsets: ["latin"], style: ["normal", "italic"] });
const data = JetBrains_Mono({ variable: "--font-data", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vernacular · the spell-checker for culture",
  description:
    "Paste any copy and pick who it's for. Vernacular scores every cultural reference on Qloo's taste graph and swaps the ones that miss for verified equivalents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${ui.variable} ${copy.variable} ${data.variable} antialiased`}>{children}</body>
    </html>
  );
}
