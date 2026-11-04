import { Button } from '../../components/ui/button';

// The layout controls' fixture (TRU-4.2). layout-panel.spec.ts writes to this file
// and puts it back after each test. The app has no Tailwind, so its classes are
// written below, in a layer, as Tailwind's are: the preview has to beat them.
const CLASSES = `:root {
  --spacing-100: 4px;
  --spacing-200: 6px;
  --spacing-300: 8px;
  --spacing-400: 12px;
  --spacing-500: 16px;
  --spacing-600: 18px;
}
@layer utilities {
  .flex { display: flex }
  .grid { display: grid }
  .flex-row { flex-direction: row }
  .gap-300 { gap: 8px }
  .px-100 { padding-inline: 4px }
  .px-400 { padding-inline: 12px }
  .px-500 { padding-inline: 16px }
  .py-200 { padding-block: 6px }
  .absolute { position: absolute }
  .left-400 { left: 12px }
  .top-500 { top: 16px }
  .w-20 { width: 80px }
  .min-h-\\[40px\\] { min-height: 40px }
  @media (width >= 48rem) { .md\\:px-500 { padding-inline: 16px } }
}`;

const SIZE = 500;

/** Takes no `className` and has no variants, as `ChatQuestionListItem` does. */
function QuestionChip({ text }: { text: string }) {
  return <p className="px-400 min-h-[40px]">{text}</p>;
}

/** Passes a `className` on, as a shared component does. */
function Card({ className, label }: { className?: string; label: string }) {
  return (
    <div aria-label={label} className={`px-400 ${className ?? ''}`}>
      {label}
    </div>
  );
}

export default function LayoutPanelPage() {
  return (
    <main style={{ position: 'relative' }}>
      <style>{CLASSES}</style>
      <section
        aria-label="A row"
        className="flex flex-row gap-300 px-400 py-200"
      >
        <div aria-label="First child" className="w-20">
          First
        </div>
        <div aria-label="Second child" className="w-20">
          Second
        </div>
      </section>
      <div aria-label="A grid" className="grid gap-300">
        <span>In the grid</span>
      </div>
      <div aria-label="A block" className="px-400">
        A block
      </div>
      <div aria-label="Wider from Tablet" className="px-400 md:px-500">
        Wider from Tablet
      </div>
      <div aria-label="Built at runtime" className={`px-${SIZE}`}>
        Built at runtime
      </div>
      <div aria-label="Placed" className="absolute left-400 top-500">
        Placed
      </div>
      <QuestionChip text="First question" />
      <QuestionChip text="Second question" />
      <Card label="A card" />
      <Button aria-label="A button">A button</Button>
    </main>
  );
}
