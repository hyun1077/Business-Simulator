import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Biz Manager",
  description: "Multi-store schedule, payroll, sales, and analytics platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
