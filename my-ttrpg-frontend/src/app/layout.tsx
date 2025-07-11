import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/contexts/NotificationContext"; // Import the provider
import GlobalNotificationHandler from "@/components/layout/GlobalNotificationHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haven - Your TTRPG Adventure Platform",
  description: "Forge your legend on Haven, the ultimate platform for tabletop role-playing games.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NotificationProvider> {/* Provider now inside body, wrapping children */}
          {children} 
          <GlobalNotificationHandler /> {/* Add the global bell handler */}
        </NotificationProvider>
      </body>
    </html>
  );
}
