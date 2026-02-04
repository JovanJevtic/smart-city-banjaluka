import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GPS Dashboard - Smart City Banja Luka',
  description: 'Real-time GPS tracking dashboard for FMC125 devices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
