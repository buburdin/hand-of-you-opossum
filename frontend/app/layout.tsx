import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hand of You",
  description: "Turn your handwriting into a font. Snap, draw, type.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://handofyou.app"),
  openGraph: {
    title: "Hand of You — turn your handwriting into a font",
    description: "snap a photo or draw letters. instant font, no signup.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Hand of You" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hand of You — turn your handwriting into a font",
    description: "snap a photo or draw letters. instant font, no signup.",
    images: ["/og.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hand of You",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1113" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
