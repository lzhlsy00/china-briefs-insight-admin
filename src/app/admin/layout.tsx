import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BiteChina Management System",
  description: "Manage BiteChina content",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
