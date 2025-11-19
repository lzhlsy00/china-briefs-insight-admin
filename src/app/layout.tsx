import '@/lib/scheduler/pushDigestScheduler';
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FortuneNews Admin",
  description: "FortuneNews content management console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-100" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
