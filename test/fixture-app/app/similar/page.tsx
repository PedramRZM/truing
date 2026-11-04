import { Search } from 'lucide-react';

const CARDS = ['One', 'Two', 'Three', 'Four'];

const TONES = {
  info: 'bg-gradient-to-r from-red-500 to-blue-500',
  error: 'bg-red-500',
};

export default function SimilarPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      {/* Inline, as the fixture has no Tailwind: what the classes would draw. */}
      <style>{`
        .banner { background-image: linear-gradient(to right, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%); }
      `}</style>
      <nav aria-label="Tabs" className="flex gap-2">
        <a className="rounded-md px-3 py-1 text-sm" href="#one">
          First tab
        </a>
        <a className="rounded-md px-3 py-1 text-sm" href="#two">
          Second tab
        </a>
        <a className="rounded-md px-3 py-1 text-sm" href="#three">
          Third tab
        </a>
      </nav>
      <ul className="grid grid-cols-2 gap-2">
        {CARDS.map((card) => (
          <li key={card} className="flex items-center gap-2 rounded-lg p-3">
            <Search className="size-4 text-red-500" />
            <span className="text-sm">{card}</span>
          </li>
        ))}
      </ul>
      <div className={`p-4 ${TONES.info}`}>Toast</div>
      <div className="banner bg-gradient-to-r from-red-500 to-blue-500 p-4">
        Banner
      </div>
      <div
        className="p-4"
        style={{ backgroundImage: 'linear-gradient(45deg, red, blue)' }}
      >
        By hand
      </div>
      <p className="p-2 text-sm">Lone text</p>
    </main>
  );
}
