import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { BottomNav } from "@/components/bottom-nav";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MINIMALISTA 出張買取",
  description: "出張買取 業務管理ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`h-full antialiased ${notoSansJP.variable}`}>
      <body className="min-h-full">
        <Providers>
          <div className="max-w-md mx-auto bg-bg min-h-screen pb-24 relative">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
