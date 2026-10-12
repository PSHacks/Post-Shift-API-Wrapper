import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Post-Shift Console",
  description: "Minimal shell for Post-Shift.Ru temporary mailboxes"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
