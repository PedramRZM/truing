import Link from 'next/link';

export const metadata = { title: 'Other page' };

export default function OtherPage() {
  return (
    <main>
      <h1>Other page</h1>
      <Link href="/">Home</Link>
    </main>
  );
}
