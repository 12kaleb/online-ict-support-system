import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'ICT Support',
  description: 'Enterprise support management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
