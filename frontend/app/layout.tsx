import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ZeroSaver - Reduce Waste, Save Money",
  description:
    "A marketplace for surplus food that helps reduce waste and save money. Connect with local businesses to rescue food before it goes to waste.",
  keywords: "food waste, surplus food, sustainability, save money, reduce waste, marketplace",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
