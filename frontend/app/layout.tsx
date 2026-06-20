import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/lib/theme-context";
import AuthBanner from "@/components/AuthBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "⬡ JARVIS — AI Executive Assistant",
  description: "AI Executive Assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('jarvis-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable}`} style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--j-bg)", overflow: "hidden" }}>
        <ThemeProvider>
          <AuthBanner />
          <div className="app-shell" style={{ flex: 1, overflow: "hidden" }}>
            <Sidebar />
            <main className="app-main">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
