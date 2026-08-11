import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inventory Copilot", template: "%s | Inventory Copilot" },
  description:
    "Retail demand forecasting, inventory optimization, and AI-powered decision intelligence. Powered by LightGBM + LangGraph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
