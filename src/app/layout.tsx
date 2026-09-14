import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MoneyPath · Your money, with a plan',
  description:
    'A private financial control centre. Know what to pay, what to reserve, and what is safe to spend.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
