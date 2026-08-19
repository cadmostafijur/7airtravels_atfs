import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const ibmPlex = IBM_Plex_Mono({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "7 Air Travels ATFS — Admin",
  description: "Administrator console for fingerprint attendance. Employees do not log in here.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${ibmPlex.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper text-ink">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
