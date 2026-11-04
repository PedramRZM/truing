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
 * Markdown as a reader sees it, with tables. HTML in the text stays text, a file
 * can't load a picture, and a link opens outside Truing's own page.
 */
export function Markdown({ text }: { text: string }) {
  const { frontmatter, body } = splitFrontmatter(text);
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
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
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
