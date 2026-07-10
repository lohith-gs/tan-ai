// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "tan(AI)",
  description: "Non-linear AI conversations",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full overflow-hidden" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased text-zinc-100 bg-[#0e111a] relative overflow-hidden h-full`}
        suppressHydrationWarning
      >
        {/* Soft top gradient fade */}
        <div
          className="absolute inset-0 bg-gradient-to-b
    from-white/[0.04] via-transparent to-transparent
    pointer-events-none"
        />

        {/* Very faint corner glow */}
        <div
          className="absolute -top-40 -right-40 w-[700px] h-[700px]
    rounded-full bg-blue-500/8 blur-[180px] pointer-events-none"
        />

        {/* Mobile gate */}
        <div className="fixed inset-0 z-50 flex md:hidden flex-col items-center justify-center bg-[#0e111a] px-8">
          <div className="flex flex-col items-center gap-6 text-center max-w-xs">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
              </svg>
            </div>
            <div className="space-y-2">
              <p className="text-zinc-100 text-sm font-medium">Desktop only</p>
              <p className="text-zinc-500 text-xs leading-relaxed">
                tan(AI)'s branching canvas needs more space. Open it on a laptop or desktop for the full experience.
              </p>
            </div>
            <p className="text-zinc-700 text-[11px] font-mono">tan(AI)</p>
          </div>
        </div>

        {/* App */}
        <div className="hidden md:contents">
          {children}
        </div>
      </body>
    </html>
  );
}
