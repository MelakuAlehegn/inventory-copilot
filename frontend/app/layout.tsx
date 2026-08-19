import type { Metadata } from "next";
import "./tokens.css";

export const metadata: Metadata = {
  title: { default: "Inventory Copilot", template: "%s | Inventory Copilot" },
  description:
    "Retail demand forecasting, inventory optimization, and AI-powered decision intelligence. Powered by LightGBM + LangGraph.",
};

// Set the theme before first paint so there's no flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var d=document.documentElement;d.setAttribute('data-theme',t);d.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load fonts via a stylesheet link (a CSS @import is stripped by the Tailwind build). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
