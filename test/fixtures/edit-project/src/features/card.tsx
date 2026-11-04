import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CardProps = {
  items: string[];
  className?: string;
  active: boolean;
  tone: string;
};

export function Card({ items, className, active, tone }: CardProps) {
  return (
    <section id="card" className="flex flex-col gap-200 px-400 md:px-500">
      <h2 id="title" className={'text-title-m text-primary'}>
        Your changes
      </h2>
      <p id="rtl">سلام دنیا</p>
      <p id="cjk">設計を確認</p>
      <span id="emoji">🎨👩‍🎨</span> <b id="after-emoji">Bold</b>
      <div
        id="cn"
        className={cn('rounded-200 p-300', active && 'bg-primary', className)}
      />
      <div id="cn-no-literal" className={cn(active && 'border', className)} />
      <div id="runtime" className={`p-${tone}`} />
      <div id="plain" />
      <p id="mixed">
        Hello <b>world</b>
      </p>
      <p id="dynamic-text">{tone}</p>
      <p id="entity">Fish &amp; chips</p>
      <Button id="save" variant="tonal-neutral">
        Save
      </Button>
      <Button id="default">Cancel</Button>
      <Button id="expr" variant={tone as 'solid'}>
        Go
      </Button>
      <ul>
        {items.map((item) => (
          <li id="item" key={item} className="py-100">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
