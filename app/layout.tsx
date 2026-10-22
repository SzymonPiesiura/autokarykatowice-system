import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autokary Katowice — Panel Floty",
  description: "Prototyp systemu zarządzania flotą Autokary Katowice",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
