import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Living Sites",
  description: "Living Sites organization administration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
