import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { PortfolioProvider } from "@/context/portfolio-context"
import ReactQueryProvider from "@/components/query-provider" // <--- Import

export const metadata: Metadata = {
  title: "PortfolioOS",
  description: "Track your wealth",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <ReactQueryProvider> {/* <--- Outer Wrapper */}
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <PortfolioProvider>
                {children}
            </PortfolioProvider>
            </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}