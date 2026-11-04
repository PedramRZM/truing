import { SessionProvider, ThemeProvider, Tracker } from './providers';

// The Design view's fixture (TRU-3.6): providers around the page, a wrapper with
// nothing of its own, a flex row, a grid, an image, an icon, an empty frame
// and Persian text, right-aligned included.
const PIXEL =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="teal"/%3E%3C/svg%3E';

function QuestionCard({ title }: { title: string }) {
  return (
    <section style={{ padding: 16, border: '1px solid gray' }}>
      <h2>{title}</h2>
    </section>
  );
}

function PassThrough({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export default function LayersPage() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <Tracker />
        <main style={{ padding: 8 }}>
          <div style={{ display: 'flex', gap: 8 }} aria-label="Toolbar row">
            <button type="button">Save</button>
            <a href="#more">Read more</a>
            <svg width="16" height="16" aria-hidden>
              <circle cx="8" cy="8" r="8" />
            </svg>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <p>Grid item</p>
            <p>
              Mixed <b>words</b> here
            </p>
          </div>
          <PassThrough>
            <PassThrough>
              <h1>Wrapped heading</h1>
            </PassThrough>
          </PassThrough>
          <QuestionCard title="A question" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PIXEL} alt="A teal square" width={48} height={48} />
          <div style={{ height: 24 }} aria-hidden />
          <p dir="rtl" style={{ textAlign: 'right' }}>
            سلام دنیا
          </p>
          <p dir="rtl">این یک متن فارسی است</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PIXEL} alt="تصویر آزمایشی" width={48} height={48} />
          <span
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clipPath: 'inset(50%)',
            }}
          >
            Only for screen readers
          </span>
        </main>
      </SessionProvider>
    </ThemeProvider>
  );
}
