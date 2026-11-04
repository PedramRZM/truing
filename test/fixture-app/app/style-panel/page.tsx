import type { ReactNode } from 'react';

// The style controls' fixture (TRU-4.3). style-panel.spec.ts writes to this file
// and puts it back after each test. The app has no Tailwind, so its classes and
// the tokens they read are written below, in a layer, as Tailwind's are.
const CLASSES = `:root {
  --background: #ffffff;
  --foreground: #181b24;
  --card: #fafafa;
  --primary: #1c68d4;
  --muted: #eeeeee;
  --color-background: var(--background);
  --color-card: var(--card);
  --color-grey-300: #d4d4d8;
  --color-grey-400: #a1a1aa;
  --color-grey-700: #3f3f46;
  --text-label-md: 14px;
  --text-label-md--line-height: 1.3;
  --text-label-md--font-weight: 600;
  --text-title-m: 16px;
  --text-title-m--line-height: 18px;
  --text-title-m--font-weight: 700;
  --radius-lg: 12px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --shadow-floating-card: 0 4px 12px 0 rgb(24 27 36 / 0.05);
}
main { background: #ffffff }
@layer utilities {
  .bg-card { background-color: var(--color-card) }
  .bg-background { background-color: var(--color-background) }
  .bg-\\[\\#1c68d4\\] { background-color: #1c68d4 }
  .border-grey-300 { border-color: var(--color-grey-300) }
  .text-grey-300 { color: var(--color-grey-300) }
  .text-grey-700 { color: var(--color-grey-700) }
  .text-title-m {
    font-size: var(--text-title-m);
    line-height: var(--text-title-m--line-height);
    font-weight: var(--text-title-m--font-weight);
  }
  .font-bold { font-weight: 700 }
  .leading-5 { line-height: 20px }
  .rounded-lg { border-radius: var(--radius-lg) }
  .rounded-xl { border-radius: var(--radius-xl) }
  .rounded-\\[18px\\] { border-radius: 18px }
  .rounded-full { border-radius: 9999px }
  .border { border-style: solid; border-width: 1px }
  .border-transparent { border-color: transparent }
  .opacity-100 { opacity: 1 }
  .shadow-\\[0_4px_12px_0_rgba\\(24\\,27\\,36\\,0\\.05\\)\\] {
    box-shadow: 0 4px 12px 0 rgba(24, 27, 36, 0.05);
  }
  .flex { display: flex }
  .gap-3 { gap: 12px }
  .p-3 { padding: 12px }
  .px-400 { padding-inline: 12px }
  .py-200 { padding-block: 6px }
  .underline { text-decoration-line: underline }
  @media (width >= 48rem) { .md\\:text-title-m { font-size: 16px } }
}`;

const cn = (...parts: (string | false)[]): string =>
  parts.filter(Boolean).join(' ');

/** Takes no `className` and has no variants, as `ChatQuestionListItem` does. */
function QuestionChip({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={String(children)}
      className={cn(
        'min-h-[40px] p-3 rounded-[18px] border border-transparent bg-background text-grey-700 opacity-100 shadow-[0_4px_12px_0_rgba(24,27,36,0.05)]',
        'hover:border-grey-400',
      )}
    >
      <span>{children}</span>
      <svg aria-hidden width="12" height="12" />
    </button>
  );
}

/** Picks its classes from a condition, as `ChatQuestionList` does. */
function QuestionList({
  separated,
  children,
}: {
  separated: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-label="A list"
      className={cn(
        'flex',
        separated
          ? 'gap-3 rounded-full'
          : 'rounded-xl bg-background px-400 py-200',
      )}
    >
      {children}
    </div>
  );
}

export default function StylePanelPage() {
  return (
    <main>
      <style>{CLASSES}</style>
      <div aria-label="A card" className="bg-card rounded-lg text-title-m">
        A card
      </div>
      <p aria-label="Styled text" className="text-title-m">
        Styled text
      </p>
      <p aria-label="Bold style" className="text-title-m font-bold">
        Bold style
      </p>
      <p aria-label="Faint text" className="text-grey-300">
        Faint text
      </p>
      <p aria-label="Underlined" className="underline">
        Underlined
      </p>
      <div aria-label="Fill by hand" className="bg-[#1c68d4]">
        Fill by hand
      </div>
      <div aria-label="Bordered" className="border border-grey-300">
        Bordered
      </div>
      <div aria-label="A bare box" className="flex" style={{ height: 40 }}>
        <i />
        <i />
      </div>
      <QuestionList separated={false}>
        <QuestionChip>First question</QuestionChip>
        <QuestionChip>Second question</QuestionChip>
      </QuestionList>
    </main>
  );
}
