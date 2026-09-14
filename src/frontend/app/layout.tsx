import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import ChatBot from "./components/ChatBot";

export const metadata: Metadata = {
  title: "YieldIQ — Semiconductor Yield Intelligence",
  description: "Find the failure. Before it costs millions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <ChatBot />
      </body>
    </html>
  );
}
