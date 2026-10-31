import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SubLoop | Subscription operations",
  description: "Subscription billing, customer portal, and finance reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
