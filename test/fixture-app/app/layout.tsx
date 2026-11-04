export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Inline, so no PostCSS config from the repo applies. */}
        <style>{`
          [data-breakpoint] { display: none; }
          @media (max-width: 767px) { [data-breakpoint='phone'] { display: block; } }
          @media (min-width: 768px) and (max-width: 1279px) { [data-breakpoint='tablet'] { display: block; } }
          @media (min-width: 1280px) { [data-breakpoint='desktop'] { display: block; } }
        `}</style>
        <p aria-label="breakpoint">
          <span data-breakpoint="phone">phone layout</span>
          <span data-breakpoint="tablet">tablet layout</span>
          <span data-breakpoint="desktop">desktop layout</span>
        </p>
        {children}
      </body>
    </html>
  );
}
