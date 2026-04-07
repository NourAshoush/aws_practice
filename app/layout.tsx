import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWS Exam Practice",
  description: "Personal AWS exam review app built from your practice question bank."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
