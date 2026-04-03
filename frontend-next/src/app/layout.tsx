import type { Metadata } from 'next'
import { ColorSchemeScript } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import './globals.css'
import MantineProviderWrapper from '@/components/providers/MantineProviderWrapper'

export const metadata: Metadata = {
  title: 'OMC - 백테스팅 플랫폼',
  description: '암호화폐 전략 백테스팅 플랫폼',
  icons: { icon: '/icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProviderWrapper>{children}</MantineProviderWrapper>
      </body>
    </html>
  )
}
