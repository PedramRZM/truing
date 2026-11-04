// The properties panel's fixture (TRU-3.8): real values for a frame, for text,
// for something placed absolutely, and for one with nothing set. The app has
// no stylesheet, so they're written inline.
export default function PropertiesPage() {
  return (
    <main>
      <style>{'.fades:hover { opacity: 0.5 }'}</style>
      <button type="button" className="fades">
        Fades on hover
      </button>
      <section
        aria-label="Filled card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxSizing: 'border-box',
          width: 320,
          padding: '12px 16px',
          borderRadius: 8,
          border: '2px solid rgb(10, 20, 30)',
          background: 'rgb(61, 130, 242)',
          boxShadow: '0 2px 4px rgb(0, 0, 0)',
          opacity: 0.5,
        }}
      >
        <p>Inside the card</p>
      </section>
      <div aria-label="Bare frame" style={{ height: 40 }}>
        <span aria-hidden />
        <span aria-hidden />
      </div>
      <h1 style={{ fontSize: 24, textDecoration: 'underline' }}>
        A heading in words
      </h1>
      <div
        aria-label="Placed box"
        style={{
          position: 'absolute',
          left: 40,
          top: 500,
          width: 60,
          height: 60,
        }}
      >
        <span aria-hidden />
        <span aria-hidden />
      </div>
    </main>
  );
}
