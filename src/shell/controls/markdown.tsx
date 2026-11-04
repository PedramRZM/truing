import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** A Markdown file's YAML frontmatter, apart from what's meant for reading. */
export function splitFrontmatter(text: string): {
  frontmatter: string | null;
  body: string;
} {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(
    text,
  );
  if (!match) return { frontmatter: null, body: text };
  return { frontmatter: match[1] ?? '', body: text.slice(match[0].length) };
}

/**
 * Where a link can go. TRU-5.3: Claude writes `[a.tsx](src/a.tsx:12)`, which would
 * open Truing's own page, so an address that can't open anything stays words.
 */
export function linkTarget(href: string | undefined): string | null {
  return href && /^(?:https?:|mailto:)/i.test(href) ? href : null;
}

/**
 * Markdown as a reader sees it, with tables. HTML in the text stays text, a file
 * can't load a picture, and a link opens outside Truing's own page.
 */
export function Markdown({
  text,
  file = true,
}: {
  text: string;
  /** A file can open with frontmatter; an answer that opens with `---` has a rule. */
  file?: boolean;
}) {
  const { frontmatter, body } = file
    ? splitFrontmatter(text)
    : { frontmatter: null, body: text };
  return (
    <div className="markdown">
      {frontmatter ? (
        <pre className="markdown-frontmatter">{frontmatter}</pre>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img']}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => {
            const target = linkTarget(href);
            if (!target) return <>{children}</>;
            // The words can say anything, so the address shows on hover.
            return (
              <a href={target} title={target} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          // Wide tables scroll by themselves, not the panel.
          table: ({ children }) => (
            <div className="markdown-table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
