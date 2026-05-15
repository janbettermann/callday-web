import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Marketing display + headings.
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Body copy.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Labels and small accents (// THE FLOW, etc.).
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://callday.app"),
  title: "Callday — Make today a Callday.",
  description:
    "The cold calling app for solo founders and freelancers. Less avoiding. More dialing. Apply for one of 50 closed-beta spots.",
  openGraph: {
    title: "Callday — Make today a Callday.",
    description:
      "Less avoiding. More dialing. Cold calling momentum that survives the gaps where focus usually dies.",
    url: "https://callday.app",
    siteName: "Callday",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Callday — Make today a Callday.",
    description:
      "Less avoiding. More dialing. Cold calling momentum that survives the gaps where focus usually dies.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
