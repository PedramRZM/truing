// TRU-2.5's fixture: a row whose gaps come from space-between, a column whose
// gap is a margin, and a box whose padding a spacing class sets. The row and
// the column are padded, so a point near their corner picks them at any zoom. The fixture
// app ships no Tailwind, so the class's value is written inline beside it, as
// the token table reads it (`px-400` is 12 px in test/fixtures/tokens).
export function SpacingFixture() {
  return (
    <section aria-label="Spacing fixture" style={{ width: 320 }}>
      <div
        aria-label="Spaced row"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: 12,
        }}
      >
        <span>One</span>
        <span>Two</span>
        <span>Three</span>
      </div>
      {/* A wrapper without a box: the outline goes to the section. */}
      <div style={{ display: 'contents' }}>
        <div aria-label="Stacked" style={{ padding: 12 }}>
          <p style={{ margin: '0 0 8px' }}>Above</p>
          <p style={{ margin: 0 }}>Below</p>
        </div>
      </div>
      <div
        aria-label="Token box"
        className="px-400"
        style={{ padding: '0 12px' }}
      >
        Token padding
      </div>
    </section>
  );
}
