import type { Metadata } from "next";

/**
 * Layout fuer die Admin-Routen. Setzt globale `noindex,nofollow`-Robots-
 * Meta, damit selbst wenn der geheime Pfad mal in einer Referer-Chain
 * landet, Crawler ihn nicht aufnehmen.
 *
 * Wrapper-Background ueberschreibt den dunklen `html`-Bg aus globals.css
 * (Marketing-Site-Default), damit das Dashboard hell + leserlich ist.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1a1d26]">
      {children}
    </div>
  );
}
