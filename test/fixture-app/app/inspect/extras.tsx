/* eslint-disable @next/next/no-img-element -- a plain <img>, as the browser sees a page's background. */

// TRU-2.3's fixture: a box with padding and an auto margin, an icon, and the two
// things that kept a real chat page from being picked: a background picture
// laid over text, and a disabled button with `pointer-events: none` (shadcn's
// Button sets it).
const BACKGROUND =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Ccircle cx='5' cy='5' r='2' fill='%23c8b0ff' fill-opacity='0.3'/%3E%3C/svg%3E";

export function Extras() {
  return (
    <>
      <div
        aria-label="Spaced box"
        style={{ width: 240, margin: '8px auto', padding: '12px 16px' }}
      >
        <span>First child</span> <span>Second child</span>
      </div>
      <svg
        role="img"
        aria-label="Fixture icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="4" />
        {/* Apart from the cross: the paths of an icon have no gaps to show (TRU-2.5). */}
        <path d="M1 23h2" stroke="currentColor" strokeWidth="1" />
      </svg>
      {/* A logo over its card's gradient: the logo is what's seen and picked. */}
      <section
        aria-label="Badge"
        style={{ position: 'relative', height: 48, width: 160 }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #eee, #ccc)',
          }}
        />
        <img
          alt="Badge logo"
          src={BACKGROUND}
          width={24}
          height={24}
          style={{ position: 'relative', margin: 12 }}
        />
      </section>
      <section aria-label="Covered" style={{ position: 'relative' }}>
        <p>Under the background</p>
        <img
          alt="Fixture background"
          src={BACKGROUND}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
          }}
        />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex' }}>
          <button
            type="submit"
            disabled
            aria-label="Send"
            style={{ pointerEvents: 'none', width: 36, height: 36 }}
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 16 16"
              style={{ pointerEvents: 'none' }}
            >
              <path d="M2 8h12" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </section>
    </>
  );
}
