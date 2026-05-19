import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Snitch Attendance',
  description: 'Warehouse Attendance Management System',
  icons: {
    icon: [
      {
        url: 'https://www.snitch.co.in/cdn/shop/files/SNITCH_LOGO_NEW_BLACK.png?v=1721457834',
        type: 'image/png',
      },
    ],
    shortcut: 'https://www.snitch.co.in/cdn/shop/files/SNITCH_LOGO_NEW_BLACK.png?v=1721457834',
    apple: 'https://www.snitch.co.in/cdn/shop/files/SNITCH_LOGO_NEW_BLACK.png?v=1721457834',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
