# UI craft in code: skeletons, pending states, optimistic updates, undo, tooltips, view transitions

This module shows how to build the interface details that make an app feel fast and calm. The examples use one storefront app; the names and paths are illustrative. Class names such as `bg-muted`, `bg-accent`, `delay-stale`, `duration-press` or `duration-popover`, and custom properties such as `--color-skeleton` or `--transition-delay-pending`, stand for the project's own design tokens: they render nothing until the project defines them. The type, schema and `server/` modules the examples import are not shown; they follow `data-and-actions.md`.

Version switches in this module (details in `SKILL.md`):

- `<ViewTransition>` (section 6) needs React 19.3 or the canary React that the Next.js App Router bundles; the `react` package from npm does not export it in 19.2 (checked on 19.2.7). Next.js 16.2 also needs `experimental: { viewTransition: true }`; the 16.3 docs describe no flag. `transitionTypes` on `<Link>` exists from Next.js 16.2.0.
- `updateTag` (sections 3 and 4) is documented as part of the Cache Components model (`cacheComponents: true`); section 3 says what to do without it.
- `useEffectEvent` (section 5) needs React 19.2.
- The CSS is Tailwind v4 syntax (`@utility`, `group-has-data-pending:`, `aria-*:` variants).

What was measured. These patterns were built and measured once in the app they came from (Next.js 16.3.5, React 19.3, headless Chromium, a 412 px wide viewport). The results show what to expect; measure again in your project before relying on them.

- **Skeleton**: skeleton rows and real rows were the same height (145 px each in that app), the photo frames kept their 4:3 ratio (112 × 84 px), and layout shift was 0. The skeleton was mounted invisible and faded in after the pending delay.
- **Optimistic save**: the bookmark flipped 25 ms after the tap and held with `updateTag`. The same action with `revalidateTag(tag, 'max')` flipped at 20 ms, then jumped back at 451 ms when the action ended.
- **Failed save**: it flipped, rolled back within 200 ms and showed its toast. When the action threw instead (a server error), the version without `try`/`catch` flipped back silently: no toast, only an uncaught page error. The version below shows its message with a retry.
- **Undo list, by keyboard**: pressing "Remove" moved focus to the next row's button at once, and it stayed there when the row left; pressing "Undo" in the toast returned focus to where it had come from, and the row came back.
- **Photo and its fallback**: when the photo answered 404, `ProductPhoto` showed its placeholder in the same frame instead of the alt text.
- **Tooltip group**: the first hint opened after 600 ms and its neighbour at once; after the 400 ms window the delay applied again. A hint stayed open under the pointer, closed on Escape without moving focus, opened on keyboard focus but not on a click's focus, and never opened on touch.

## 1. A skeleton built from the component's own frame

Smell: a `ProductCardSkeleton` written by hand next to the card, or an `isLoading` prop on the card. Both drift from the real layout, and the page jumps when the data arrives.

```tsx
// src/components/ui/skeleton.tsx
// Placeholders for the first load of a view. Server Components: no hooks, no 'use client'. The look lives in the
// globals.css utilities skeleton-bar and skeleton-block.

const LINE_KEYS = ['line-1', 'line-2', 'line-3'] as const; // fixed keys instead of array indexes

type SkeletonTextProps = {
  lines?: 1 | 2 | 3;
  lastLineWidth?: 'w-1/3' | 'w-1/2' | 'w-2/3' | 'w-full';
};

/** Placeholder text: each line is one line box of the surrounding text style, so it is as tall as the real text. */
export function SkeletonText({
  lines = 1,
  lastLineWidth = 'w-2/3',
}: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className="flex flex-col">
      {LINE_KEYS.slice(0, lines).map((key, position) => (
        <span key={key} className="flex items-center block-lh">
          <span
            className={`skeleton-bar ${position === lines - 1 ? lastLineWidth : 'w-full'}`}
          />
        </span>
      ))}
    </span>
  );
}

/** Placeholder media: it fills the frame it is given, so the frame keeps the real photo's ratio. */
export function SkeletonBlock() {
  return <span aria-hidden="true" className="skeleton-block block size-full" />;
}
```

```css
/* globals.css: the custom properties are placeholders for the project's design tokens */
@utility skeleton-bar {
  display: block;
  block-size: var(
    --skeleton-bar-size
  ); /* a bar centred inside a 1lh line box */
  border-radius: var(--radius-sm);
  background-color: var(--color-skeleton);
}
@utility skeleton-block {
  position: relative;
  overflow: hidden;
  background-color: var(--color-skeleton);
  @media (prefers-reduced-motion: no-preference) {
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      translate: -100% 0;
      background-image: linear-gradient(
        to right,
        transparent,
        var(--color-skeleton-highlight),
        transparent
      );
      /* --transition-duration-shimmer is 1.5 s: three runs end before 5 s (WCAG 2.2.2) */
      animation: skeleton-shimmer var(--transition-duration-shimmer) ease-in-out
        3;
    }
  }
}
@keyframes skeleton-shimmer {
  from {
    translate: -100% 0;
  }
  to {
    translate: 100% 0;
  }
}
@utility skeleton-delayed {
  /* a fast answer never flashes grey boxes; opacity leaves the reserved space in place */
  animation: skeleton-appear var(--transition-duration-popover) ease-out
    var(--transition-delay-pending) both;
}
@keyframes skeleton-appear {
  from {
    opacity: 0;
  }
}
@utility min-block-2lh {
  min-block-size: 2lh;
}
```

```tsx
// src/features/catalog/components/product-card.tsx
import { type ReactNode } from 'react';

import Link from 'next/link';

import { SkeletonBlock, SkeletonText } from '@/components/ui/skeleton';
import type { ProductCardView } from '@/features/catalog/catalog-types';
import { ProductPhoto } from '@/features/catalog/components/product-photo';
import { ProductPhotoTransition } from '@/features/catalog/components/product-photo-transition';

type ProductCardSlots = {
  media: ReactNode;
  title: ReactNode;
  price: ReactNode;
  details: ReactNode;
  actions?: ReactNode;
};

/** The card's geometry in one place. ProductCard and ProductCardSkeleton both render it, so they cannot drift. */
function ProductCardFrame({
  media,
  title,
  price,
  details,
  actions,
}: ProductCardSlots) {
  return (
    <div className="relative flex gap-3 p-3">
      {/* the thumbnail comes first in source order. self-start, because a stretched flex item ignores its aspect
          ratio */}
      <div className="bg-muted relative aspect-4/3 w-28 shrink-0 self-start overflow-hidden rounded-md">
        {media}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* every slot has a fixed number of lines (two, one, two), so a skeleton row is exactly as tall as a real one */}
        <div className="min-block-2lh text-base font-bold">{title}</div>
        {/* a static price keeps proportional numerals; tabular numerals are for values that change in place */}
        <div className="text-base">{price}</div>
        <div className="min-block-2lh text-sm">{details}</div>
      </div>
      {/* reserved in the skeleton too; after the title link in source order and positioned, so it sits above the
          link's stretched hit area and keeps its own 44 px target */}
      <div className="relative size-11 shrink-0">{actions}</div>
    </div>
  );
}

type ProductCardProps = {
  product: ProductCardView;
  actions?: ReactNode;
  /** One of the cards the first screen shows: its link prefetches the whole product page. */
  aboveTheFold?: boolean;
};

export function ProductCard({
  product,
  actions,
  aboveTheFold = false,
}: ProductCardProps) {
  return (
    <ProductCardFrame
      media={
        <ProductPhotoTransition productId={product.id}>
          <ProductPhoto src={product.photoUrl} alt={product.name} />
        </ProductPhotoTransition>
      }
      title={
        <h3 className="line-clamp-2">
          {/* the title link covers the whole card, so the card is one target */}
          <Link
            href={`/products/${product.id}`}
            // the first screen's cards prefetch the whole product page, so a tap opens it at once and the photo
            // morph plays
            prefetch={aboveTheFold ? true : undefined}
            transitionTypes={['nav-forward']}
            className="after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>
      }
      price={product.priceLabel}
      details={<p className="line-clamp-2">{product.detailsLabel}</p>}
      actions={actions}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <ProductCardFrame
      media={<SkeletonBlock />}
      title={<SkeletonText lines={2} />}
      price={<SkeletonText lastLineWidth="w-1/3" />}
      details={<SkeletonText lines={2} lastLineWidth="w-1/2" />}
    />
  );
}
```

```tsx
// src/features/catalog/components/product-photo.tsx
'use client';
import { useState } from 'react';

import Image from 'next/image';

/** A product photo. A product without one, or a photo that fails to load, shows the same-size placeholder instead
 *  of its alt text. The photo's host has to be allowed in `images.remotePatterns`. */
export function ProductPhoto({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src === null || failed) {
    return (
      <span className="flex size-full items-center justify-center text-sm">
        No photo
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="112px" // the frame is w-28, 112 px wide
      className="object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
```

```tsx
// src/features/catalog/components/product-list.tsx
import type { ProductCardView } from '@/features/catalog/catalog-types';
import {
  ProductCard,
  ProductCardSkeleton,
} from '@/features/catalog/components/product-card';

const LIST_CLASS = 'flex flex-col divide-y';
const SKELETON_ROWS = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'] as const; // one 412 × 915 screen of rows
const FIRST_SCREEN_ROWS = SKELETON_ROWS.length;

export function ProductList({
  products,
}: {
  products: readonly ProductCardView[];
}) {
  return (
    <ol aria-label="Search results" className={LIST_CLASS}>
      {products.map((product, position) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            aboveTheFold={position < FIRST_SCREEN_ROWS}
          />
        </li>
      ))}
    </ol>
  );
}

/** The first load of the results. Its height is reserved from the first frame, but it fades in only after the
 *  pending delay, so a fast answer never flashes grey boxes. */
export function ProductListSkeleton() {
  return (
    <div className="skeleton-delayed">
      <p role="status" className="sr-only">
        Loading products…
      </p>
      <ol aria-hidden="true" className={LIST_CLASS}>
        {SKELETON_ROWS.map((key) => (
          <li key={key}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ol>
    </div>
  );
}
```

```tsx
// src/features/catalog/components/product-results.tsx
import { ProductList } from '@/features/catalog/components/product-list';
import { searchProducts } from '@/features/catalog/server/catalog-queries';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The streamed part of the search page. While a filter chip's navigation runs, the old results stay and dim after
 *  the stale delay instead of turning back into a skeleton. */
export async function ProductResults({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const products = await searchProducts(typeof q === 'string' ? q : '');
  return (
    <div className="group-has-data-pending:delay-stale transition-opacity group-has-data-pending:opacity-50">
      <ProductList products={products} />
    </div>
  );
}
```

```tsx
// src/app/search/page.tsx
import { Suspense } from 'react';

import { FilterChips } from '@/features/catalog/components/filter-chips';
import { ProductListSkeleton } from '@/features/catalog/components/product-list';
import { ProductResults } from '@/features/catalog/components/product-results';
import { ProductResultsErrorBoundary } from '@/features/catalog/components/product-results-error-boundary';

// Not async: the heading and the filters render at once and only the results stream (with cacheComponents the
// shell is prerendered).
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">Search products</h1>
      {/* `group`: the filter chips in this section set data-pending while their navigation runs */}
      <section aria-label="Results" className="group flex flex-col gap-3">
        <FilterChips />
        <ProductResultsErrorBoundary>
          <Suspense fallback={<ProductListSkeleton />}>
            <ProductResults searchParams={searchParams} />
          </Suspense>
        </ProductResultsErrorBoundary>
      </section>
    </main>
  );
}
```

Why: the geometry is written once, so the skeleton cannot drift from the card; the skeleton is a Server Component that costs no client JavaScript, and the card needs no optional data or `isLoading` branches. Two things broke that promise when it was measured, and both are now in the frame:

- **Every slot needs a fixed number of lines.** On a 412 px phone the details line wrapped to two lines, which made real rows 20 px taller than skeleton rows. A clamp on the content plus `min-block-2lh` on the slot fixes the count.
- **A thumbnail frame in a flex row needs `self-start`.** A stretched flex item ignores `aspect-ratio`, so the 4:3 frame had grown to the row's height.

`ProductListSkeleton` renders as many rows as fill one screen, with fixed keys. The first screen's cards pass `aboveTheFold`, so their links prefetch the whole product page (`prefetch={true}`, which Next.js applies in production only); the other links keep the default. `ProductPhoto` falls back to the placeholder when an image fails to load, and a product without a photo gets the same frame. `ProductResultsErrorBoundary` is made with `catchError` (`data-and-actions.md` section 7), with its fallback in about the same minimum height. Empty results render inside the same list frame, never a smaller box. Measure the row heights at a narrow viewport (412 px here) before relying on a new frame.

## 2. Pending without flashing: delayed indicators, stale content dimmed

```tsx
// src/features/catalog/components/filter-chip.tsx
'use client';
import { useOptimistic, useTransition } from 'react';

import { useRouter } from 'next/navigation';

/** A filter chip that answers at once: its own state is optimistic, and while the new results are on their way it
 *  marks itself data-pending, which dims the results section (section 1). */
export function FilterChip({
  label,
  selected,
  href,
}: {
  label: string;
  selected: boolean;
  href: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shownSelected, setShownSelected] = useOptimistic(selected);
  return (
    <button
      type="button"
      aria-pressed={shownSelected}
      data-pending={isPending ? '' : undefined}
      onClick={() => {
        startTransition(() => {
          setShownSelected(!shownSelected);
          router.push(href, { scroll: false });
        });
      }}
      className="aria-pressed:bg-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-4"
    >
      {/* the check always takes its place: selecting changes the fill and the icon, never the chip's width. A stroke
          of 2 on the 24 grid renders 1.33 px at 16 px, about the stem weight of 16 px regular text */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`size-4 ${shownSelected ? 'opacity-100' : 'opacity-0'}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M5 12l5 5 9-10" />
      </svg>
      {label}
    </button>
  );
}
```

Why: the chip answers the tap at once (optimistic `aria-pressed`) and keeps its width, because the check icon always takes its place. While the navigation runs, `data-pending` on the chip lets the results in section 1 dim through `group-has-data-pending:` after the stale delay: the old results stay readable, nothing turns back into a skeleton, and no `isLoading` prop is threaded through (the Next.js 16.3 guide "Building interactive apps" describes this pattern; it is not in the 16.2 bundled docs). Buttons that submit follow `data-and-actions.md` section 4: the label stays, and a spinner in a reserved slot fades in after the pending delay. Keeping an indicator on screen for at least 300 ms once shown needs a timer; the `spin-delay` package does that with its `delay` and `minDuration` options (their defaults are 500 and 200 ms, so pass your own numbers).

## 3. An optimistic toggle whose rollback moves nothing

```ts
// src/features/wishlist/wishlist-actions.ts
'use server';

import { updateTag } from 'next/cache';

import { setProductSaved } from '@/features/wishlist/server/wishlist-mutations';
import { setProductSavedSchema } from '@/features/wishlist/wishlist-schemas';
import type { SetProductSavedResult } from '@/features/wishlist/wishlist-types';

// The target state, not a toggle: pressing twice, or retrying after a lost response, ends in the same place.
export async function setProductSavedAction(input: {
  productId: string;
  saved: boolean;
}): Promise<SetProductSavedResult> {
  const parsed = setProductSavedSchema.safeParse(input); // a public endpoint: parse everything
  if (!parsed.success)
    return { status: 'failed', message: 'This product cannot be saved' };
  // the owner comes from the session inside the mutation, never from the client
  const result = await setProductSaved(
    parsed.data.productId,
    parsed.data.saved,
  );
  if (result.kind === 'product-not-found')
    return { status: 'failed', message: 'This product is no longer available' };
  // read-your-writes: this response re-renders with the new truth. revalidateTag(tag, 'max') would not, and the
  // bookmark would jump back to its old state when the action ends
  updateTag(`saved-products:${result.ownerId}`);
  return { status: 'saved', saved: parsed.data.saved };
}
```

```tsx
// src/features/wishlist/components/save-product-toggle.tsx
'use client';
import { startTransition, useOptimistic, useState } from 'react';

import { ToastMessage } from '@/components/ui/toast-message';
import { setProductSavedAction } from '@/features/wishlist/wishlist-actions';

export function SaveProductToggle({
  productId,
  saved,
}: {
  productId: string;
  saved: boolean;
}) {
  const [shownSaved, setShownSaved] = useOptimistic(saved);
  const [failure, setFailure] = useState<string | null>(null);

  function save(nextSaved: boolean) {
    setFailure(null);
    startTransition(async () => {
      setShownSaved(nextSaved);
      try {
        const result = await setProductSavedAction({
          productId,
          saved: nextSaved,
        });
        // the bookmark is already back to the server's truth; say why, in a place that moves nothing
        if (result.status === 'failed') setFailure(result.message);
      } catch {
        // a lost connection or a server error: React would only report it globally, and the bookmark would
        // silently flip back
        setFailure(
          'Could not save. Check your internet connection and try again.',
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-pressed={shownSaved}
        aria-label="Save product"
        // from the optimistic value, so a quick second tap undoes the first instead of repeating it
        onClick={() => {
          save(!shownSaved);
        }}
        className="inline-flex size-11 items-center justify-center"
      >
        {/* the fill changes as a colour (under 150 ms, kept under reduced motion): no pop, no bounce on a
            control people tap often */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`duration-press size-6 transition-colors ${shownSaved ? 'fill-current' : 'fill-transparent'}`}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        >
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
      </button>
      <ToastMessage
        notice={
          failure === null
            ? null
            : {
                message: failure,
                actionLabel: 'Try again',
                onAction: () => {
                  save(!saved);
                },
              }
        }
        onDismiss={() => {
          setFailure(null);
        }}
      />
    </>
  );
}
```

```tsx
// src/components/ui/toast-message.tsx
'use client';
import { type FocusEvent, useRef } from 'react';

export type ToastNotice = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

/** One overlay line for messages that must not move the layout. Always mounted, so screen readers announce what
 *  appears in it; it stays until it is acted on or dismissed, never on a timer. */
export function ToastMessage({
  notice,
  onDismiss,
}: {
  notice: ToastNotice | null;
  onDismiss: () => void;
}) {
  // where focus was before it entered the toast: pressing a button here removes the button, so focus goes back
  // there instead of falling to <body>
  const returnFocusTo = useRef<HTMLElement | null>(null);

  function rememberOrigin(event: FocusEvent<HTMLButtonElement>) {
    const from = event.relatedTarget;
    // moving between the toast's own buttons keeps the original place
    if (
      from instanceof HTMLElement &&
      !event.currentTarget.parentElement?.contains(from)
    )
      returnFocusTo.current = from;
  }

  function close(then?: () => void) {
    const target = returnFocusTo.current;
    onDismiss();
    then?.();
    if (target?.isConnected) target.focus();
  }

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-4 flex justify-center"
    >
      {notice === null ? null : (
        <div className="pointer-events-auto flex items-center gap-3 rounded-md px-4 py-2 shadow-md">
          <p>{notice.message}</p>
          <button
            type="button"
            className="min-h-11 px-3"
            onFocus={rememberOrigin}
            onClick={() => {
              close(notice.onAction);
            }}
          >
            {notice.actionLabel}
          </button>
          <button
            type="button"
            aria-label="Close"
            className="size-11"
            onFocus={rememberOrigin}
            onClick={() => {
              close();
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

Why: `useOptimistic` shows the new state at once and falls back to the prop when the Action settles, so the prop must already be the new truth by then. That is why the action calls `updateTag`: `revalidateTag(tag, 'max')` sends no re-render with the response (Next.js 16.3 guide "Server Actions and Mutations"), and the bookmark was measured jumping back 451 ms after the tap. The action receives the target state (`saved: true`), never "toggle", so a double tap or a retry is harmless. A failure needs no manual rollback, because the value is already back to the truth. It is explained in an overlay that moves nothing, with a retry, and it stays until acted on or dismissed, never on a timer. The `catch` matters: an action that throws (a lost connection, a server error) never reaches the component otherwise, because React reports it globally, so the person would see the bookmark flip back and nothing else. Pressing a button in the toast removes that button, so the toast returns focus to where it came from. Be optimistic only about what the person decides (saving, hiding, a threshold they typed), never about a price, a stock count, a total or a new record's id. In an app, one page-level toast region replaces the per-toggle `ToastMessage`.

Without Cache Components, check what your version documents for `updateTag` (its API reference also lists `fetch` tags as targets). Otherwise `revalidatePath` or `refresh()` from `next/cache` re-render the current route with the action's response; the Next.js 16.3 guide "Server Actions and Mutations" describes both that way, and the 16.2 bundled docs do not spell it out, so check it in your version.

## 4. Undo instead of a confirmation

```tsx
// src/features/collections/components/collection-list.tsx
'use client';
import {
  startTransition,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
} from 'react';

import { ToastMessage, type ToastNotice } from '@/components/ui/toast-message';
import {
  removeCollectionAction,
  restoreCollectionAction,
} from '@/features/collections/collections-actions';
import type { CollectionView } from '@/features/collections/collections-types';

type ShownCollection = CollectionView & { removing?: true };

const OFFLINE = 'Check your internet connection and try again.';

export function CollectionList({
  collections,
}: {
  collections: CollectionView[];
}) {
  // the row stays, dimmed and labelled, until the server confirms; then it leaves and the undo appears
  const [shownCollections, markRemoving] = useOptimistic<
    ShownCollection[],
    string
  >(collections, (current, collectionId) =>
    current.map((collection) =>
      collection.id === collectionId
        ? { ...collection, removing: true }
        : collection,
    ),
  );
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Only with cacheComponents: Next.js hides this route on navigation instead of unmounting it, so an old undo
  // must not greet the person on Back. Without cacheComponents the route unmounts, and this effect can go.
  useLayoutEffect(
    () => () => {
      setNotice(null);
    },
    [],
  );

  function remove(collection: CollectionView, pressed?: HTMLElement) {
    // the pressed button is about to disappear: hand focus to a neighbouring row's button, or to the list, first,
    // so it never falls back to <body>
    const row = pressed?.closest('li');
    const neighbour =
      row?.nextElementSibling?.querySelector('button') ??
      row?.previousElementSibling?.querySelector('button');
    if (pressed) (neighbour ?? listRef.current)?.focus();
    setNotice(null);
    startTransition(async () => {
      markRemoving(collection.id);
      const retry = {
        actionLabel: 'Try again',
        onAction: () => {
          remove(collection);
        },
      };
      try {
        const result = await removeCollectionAction({
          collectionId: collection.id,
        });
        setNotice(
          result.status === 'done'
            ? {
                message: `Collection "${collection.name}" removed`,
                actionLabel: 'Undo',
                onAction: () => {
                  restore(collection);
                },
              }
            : { message: result.message, ...retry },
        );
      } catch {
        setNotice({ message: `Could not remove it. ${OFFLINE}`, ...retry });
      }
    });
  }

  function restore(collection: CollectionView) {
    startTransition(async () => {
      const retry = {
        actionLabel: 'Try again',
        onAction: () => {
          restore(collection);
        },
      };
      try {
        const result = await restoreCollectionAction({
          collectionId: collection.id,
        });
        if (result.status === 'failed')
          setNotice({ message: result.message, ...retry });
      } catch {
        setNotice({ message: `Could not restore it. ${OFFLINE}`, ...retry });
      }
    });
  }

  return (
    <>
      {/* focusable from script only: the place focus goes when the last row leaves */}
      <ul
        ref={listRef}
        tabIndex={-1}
        aria-label="Collections"
        className="flex flex-col divide-y"
      >
        {shownCollections.map((collection) => (
          <li
            key={collection.id}
            aria-busy={collection.removing}
            className="flex min-h-14 items-center gap-4 transition-opacity aria-busy:opacity-50"
          >
            <span className="min-w-0 flex-1 truncate">{collection.name}</span>
            {collection.removing ? (
              <span className="text-sm">Removing…</span>
            ) : (
              <button
                type="button"
                className="min-h-11 px-3"
                onClick={(event) => {
                  remove(collection, event.currentTarget);
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <ToastMessage
        notice={notice}
        onDismiss={() => {
          setNotice(null);
        }}
      />
    </>
  );
}
```

Why: a confirmation dialog gets clicked through by habit; undo removes the risk (Aza Raskin, NN/g). The row stays, dimmed and marked "Removing…", until the server confirms, and only then leaves; "Undo" restores it. The pressed "Remove" is replaced at once, so focus first moves to a neighbouring row's button, or to the list, and never falls to `<body>`. `removeCollectionAction` and `restoreCollectionAction` set a `removed` flag and call `updateTag` (see section 3 for the options without Cache Components), so both are safe to repeat. The toast stays until the next action or a dismissal. Because a disappearing toast is still a time limit (WCAG 2.2.1), keep a lasting way back as well, such as a recently removed list. With `cacheComponents: true`, Next.js hides a route in `<Activity>` instead of unmounting it and keeps a few recent routes that way; the `useLayoutEffect` cleanup clears the notice when the route is hidden, so Back does not show an old undo (Next.js "Preserving UI state" guide).

## 5. A tooltip delay group

```tsx
// src/components/ui/icon-button.tsx
'use client';
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

// One delay group for the whole page: the first tooltip waits, then its neighbours open at once and without their
// fade while the pointer keeps exploring. Radix's Tooltip.Provider and Base UI's do the same.
const FIRST_DELAY_MS = 600; // Base UI's default; libraries use 500 to 1500
const SKIP_WINDOW_MS = 400; // counted from when the previous tooltip closed; libraries use 300 to 400
const delayGroup = { lastClosedAt: Number.NEGATIVE_INFINITY };

type TooltipState = 'closed' | 'open' | 'instant';

/** An icon-only button (the one in composition-and-boundaries.md section 5, with a tooltip added). Its name is the
 *  aria-label; the tooltip repeats it for mouse users and is hidden from screen readers, which already hear the
 *  name. */
export function IconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  const [tooltip, setTooltip] = useState<TooltipState>('closed');
  const openTimer = useRef<number | undefined>(undefined);
  const isOpen = tooltip !== 'closed';

  function open(instant: boolean) {
    window.clearTimeout(openTimer.current);
    if (instant) setTooltip('instant');
    else
      openTimer.current = window.setTimeout(() => {
        setTooltip('open');
      }, FIRST_DELAY_MS);
  }

  function close() {
    window.clearTimeout(openTimer.current);
    if (isOpen) delayGroup.lastClosedAt = performance.now();
    setTooltip('closed');
  }

  // Escape dismisses it wherever focus and the pointer are (WCAG 1.4.13)
  const onEscape = useEffectEvent(close);
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onEscape();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // a mouse only: touch has no hover, and touch laptops defeat the hover media query
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse')
          open(performance.now() - delayGroup.lastClosedAt < SKIP_WINDOW_MS);
      }}
      onPointerLeave={close}
      onPointerDown={close} // pressing performs the action; the hint gets out of the way
      // keyboard focus opens it at once; the focus a click causes does not
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) open(true);
      }}
      onBlur={close}
      className="relative inline-flex size-11 items-center justify-center"
    >
      {icon}
      {/* centred with flex, not a translate; padding rather than a margin joins it to the button, so the pointer
          can move onto the open hint without closing it (WCAG 1.4.13) */}
      <span
        aria-hidden="true"
        data-state={tooltip}
        className="group/tooltip pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-2 data-[state=instant]:pointer-events-auto data-[state=open]:pointer-events-auto"
      >
        <span className="duration-popover rounded-sm px-2 py-1 text-sm whitespace-nowrap opacity-0 transition-opacity group-data-[state=instant]/tooltip:opacity-100 group-data-[state=instant]/tooltip:transition-none group-data-[state=open]/tooltip:opacity-100">
          {label}
        </span>
      </span>
    </button>
  );
}
```

Why: the first hint waits, because the pointer may be passing by. Once the person is exploring a row of icon buttons, the neighbours open at once and without their fade, within a window counted from when the last hint closed (Emil Kowalski, Vercel, Radix, Base UI, React Aria, Ariakit). The hint opens for a mouse only, since touch has no hover and a tooltip must never be the only place for information. It opens at once on keyboard focus, closes on press, blur and Escape, and can be hovered (WCAG 1.4.13). It repeats the button's `aria-label` and is hidden from screen readers, which already hear the name. Because `onClick` is a function, `IconButton` is used from client components.

If the project already has a tooltip library, configure its provider instead of hand-rolling this. Radix's `Tooltip.Provider` takes `delayDuration` (default 700) and `skipDelayDuration` (default 300). Base UI's defaults are the numbers above: one `Tooltip.Provider` (`timeout` 400) around the toolbar, `Tooltip.Trigger` with its default `delay` of 600, and `data-instant:transition-none` on the popup (Base UI sets `data-instant` when animations should be skipped). Wrappers around these libraries may set their own defaults, so check what yours passes.

## 6. A photo that morphs from the results into the product page

```tsx
// src/features/catalog/components/product-photo-transition.tsx
import { type ReactNode, ViewTransition } from 'react';

/** Names a product's main photo so it morphs from the results card into the product page and back. One mounted
 *  element per name: wrap only the first photo, on the card and on the page. */
export function ProductPhotoTransition({
  productId,
  children,
}: {
  productId: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition
      name={`product-photo-${productId}`}
      share="morph"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
```

```css
/* globals.css */
::view-transition {
  pointer-events: none; /* unnamed content stays tappable while a transition runs */
}
::view-transition-group(.morph) {
  animation-duration: var(--transition-duration-morph);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) {
    animation-duration: 0s;
  }
  ::view-transition-old(*) {
    animation: 150ms ease-out both vt-fade-out;
  }
  ::view-transition-new(*) {
    animation: 150ms ease-out both vt-fade-in;
  }
}
@keyframes vt-fade-out {
  to {
    opacity: 0;
  }
}
@keyframes vt-fade-in {
  from {
    opacity: 0;
  }
}
```

Why: the card's `<Link transitionTypes={['nav-forward']}>` (section 1) and the product page both wrap their main photo in `ProductPhotoTransition`, so the photo reads as one object moving, not two swapping (Next.js "Designing view transitions" guide).

- `share="morph"` with `default="none"` keeps each named photo from cross-fading on every unrelated transition.
- One element per name: a duplicate cancels the morph.
- The pair forms only when the product page's photo renders in the navigation's commit: the product page reads its id and the product at the top and keeps the photo outside any Suspense boundary (which also lets it answer a real 404; see `data-and-actions.md` section 2 for the trade-off), and the first screen's cards prefetch it fully (`aboveTheFold`, section 1); a card without the prefetch waits for the server before the morph plays.
- Both frames share the 4:3 ratio, so nothing stretches.
- React does not turn view transitions off for `prefers-reduced-motion`; it recommends handling it in CSS, hence the media query above (react.dev, `<ViewTransition>`).
- `::view-transition { pointer-events: none }` follows the Next.js 16.3 guide: while a transition runs the overlay captures pointer events, and hit-testing still skips the elements it names, so keep transitions short and never name elements people click rapidly. View transitions are for navigations and rare reveals, never for chips, sorting or the bookmark.
- Availability: `<ViewTransition>` needs React 19.3 or the canary React that the App Router bundles. The `react` package from npm has no such export in 19.2 (checked on 19.2.7), so a unit test that renders `ProductPhotoTransition` needs a stub there. For TypeScript, `@types/react` 19.2 declares the component in its canary types, which a Next.js project already loads because Next's own types reference `react/experimental` (checked with Next.js 16.2.9); `@types/react` 19.3 declares it in the main types. On Next.js 16.2 set `experimental: { viewTransition: true }`; the 16.3 guide describes no flag. The morph itself can only be checked in a browser (an e2e test).

## 7. Motion preferences in script: reduced motion and the device tier

```ts
// src/components/ui/motion-preferences.ts
import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** For motion driven from script (the Web Animations API, a spring, scrollIntoView). Motion in CSS uses
 *  motion-safe: instead and needs no hook. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true, // the server cannot know: render the still version until the client says otherwise
  );
}

export type DeviceTier = 'full' | 'low';

function readDeviceTier(): DeviceTier {
  // deviceMemory exists only in Chromium; Safari clamps the core count to 4 or 8. Read once, never sent anywhere.
  const memory: unknown = Reflect.get(navigator, 'deviceMemory');
  return (typeof memory === 'number' && memory < 4) ||
    navigator.hardwareConcurrency <= 2
    ? 'low'
    : 'full';
}

function subscribeToNothing() {
  return () => undefined; // the tier does not change while the page is open
}

/** The low tier drops blur, backdrop filters, morphs (fades instead), staggers and looping shimmer; never
 *  information or state feedback. It is a performance tier, not a motion preference. */
export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(subscribeToNothing, readDeviceTier, () => 'low');
}
```

Why: motion written in CSS needs no JavaScript: author it inside `motion-safe:`, and the still version wins whenever the preference is unknown. These hooks are for motion started from script. The server snapshot is the still, cheap version, so the first client render matches the server and an unknown device never gets the expensive effects first. A weak phone is a performance tier, not a motion preference: the low tier drops decoration, never information. Do not guess device capability with the Battery Status API, Compute Pressure or frame-rate sampling.
