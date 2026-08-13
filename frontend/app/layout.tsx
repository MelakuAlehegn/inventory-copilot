import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inventory Copilot", template: "%s | Inventory Copilot" },
  description:
    "Retail demand forecasting, inventory optimization, and AI-powered decision intelligence. Powered by LightGBM + LangGraph.",
};

// Set the theme before first paint so there's no flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
