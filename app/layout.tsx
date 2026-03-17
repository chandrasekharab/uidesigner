import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Low-Code UI Builder',
  description: 'Drag-and-drop UI builder with real-time JSON generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
