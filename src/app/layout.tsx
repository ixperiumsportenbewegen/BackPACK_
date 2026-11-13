import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Condensed } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BackPACK_",
  description: "Alles voor de Ardennen-meerdaagse van Sportkunde in je BackPACK_.",
  applicationName: "BackPACK_",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "BackPACK_", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#E50056",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${roboto.variable} ${robotoCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
