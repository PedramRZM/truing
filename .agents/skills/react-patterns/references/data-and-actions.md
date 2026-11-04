# Data loading, Server Actions and errors (Next.js 16, React 19)

Version switches in this module (details in `SKILL.md`):

- Sections 2 and 6 assume Cache Components (`cacheComponents: true` in `next.config.*`). `'use cache'`, `cacheLife` and `cacheTag` need that flag, and `updateTag` is documented as part of that model; each section says what to do without it.
- Section 7 uses the error APIs under their Next.js 16.2 names (`unstable_retry`, `unstable_catchError`). The stable names, `retry` and `catchError`, are (Next.js 16.3+).
- The Zod code runs unchanged on Zod 3 and Zod 4 (checked with 3.25 and 4.4).

The examples use one storefront app and a feature-folder layout (`src/features/<feature>/server/<feature>-queries.ts` for reads, `<feature>-actions.ts` for mutations, `<feature>-schemas.ts`, `<feature>-types.ts`). Names and paths are illustrative; use the project's own layout.

## 1. Read on the server, not in an effect

```tsx
// before
'use client';
export function CategoryProducts({ categoryId }: { categoryId: string }) {
  const [products, setProducts] = useState<ProductCardView[]>([]);
  useEffect(() => {
    fetch(`/api/categories/${categoryId}/products`)
      .then((response) => response.json())
      .then(setProducts);
  }, [categoryId]);
  return <ProductList products={products} />;
}
```

```tsx
// after: a Server Component calls the query function directly
import { listCategoryProducts } from '@/features/catalog/server/catalog-queries';

export async function CategoryProducts({ categoryId }: { categoryId: string }) {
  const products = await listCategoryProducts(categoryId);
  return <ProductList products={products} />;
}
```

Why: the effect version ships the component to the browser, waits for hydration before it even starts, races when `categoryId` changes, and needs an API route of our own. Next: "Fetch data in Server Components directly from its source, not via Route Handlers." When a read really has to happen in the browser (polling, filtering driven by client state), use the project's client data cache if it has one (TanStack Query, for example) rather than an effect.

## 2. A dynamic page: pass the params promise down, read in parallel

```tsx
// src/app/categories/[slug]/page.tsx: not async, so the shell renders (and, with cacheComponents, prerenders) at once
import { Suspense } from 'react';

import { CategoryPageContent } from '@/features/catalog/components/category-page-content';
import { CategoryPageSkeleton } from '@/features/catalog/components/category-page-skeleton';

export default function CategoryPage({
  params,
}: PageProps<'/categories/[slug]'>) {
  return (
    <main className="flex flex-col gap-6 p-4">
      <Suspense fallback={<CategoryPageSkeleton />}>
        <CategoryPageContent params={params} />
      </Suspense>
    </main>
  );
}
```

```tsx
// src/features/catalog/components/category-page-content.tsx
import { notFound } from 'next/navigation';

import { CategoryHeader } from '@/features/catalog/components/category-header';
import { ProductList } from '@/features/catalog/components/product-list';
import {
  getCategoryBySlug,
  listProductsForCategorySlug,
} from '@/features/catalog/server/catalog-queries';

export async function CategoryPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    listProductsForCategorySlug(slug),
  ]);
  if (category === null) notFound();
  return (
    <>
      <CategoryHeader category={category} />
      <ProductList products={products} />
    </>
  );
}
```

Why (with `cacheComponents: true`): a dynamic `params` is request-time data; awaiting it at the top of the page would block the whole route, so the Next.js streaming guide ("Push dynamic access down") passes the promise into a component under `<Suspense>`. Both reads start before either is awaited: one round trip, no waterfall. `PageProps<'/categories/[slug]'>` is a global helper that Next.js generates during `next dev`, `next build` or `next typegen`. Without `cacheComponents` the page can simply be `async` and `await params` at the top; a `<Suspense>` boundary around the slow component (or a `loading.tsx`) still streams it.

Trade-off: `notFound()` after streaming has started sends the not-found UI with HTTP 200 and a `noindex` meta tag (Next.js streaming guide, "The HTTP contract"). When a real 404 status matters for a route, prerender its known slugs with `generateStaticParams`, or make the route blocking on purpose: read the params and check the record at the top of the page, before any `await` that can suspend and with no `<Suspense>` or `loading.tsx` above it, so `notFound()` runs before anything streams. With `cacheComponents` a blocking route has to be declared as such, or the build fails. (Next.js 16.3+) `export const instant = false` on the page does that. The 16.2 bundled docs show no per-route equivalent; they describe an empty-fallback `<Suspense>` above the document body in a root layout ("Opting out of the static shell" in the caching guide), which defers every route under that layout to request time. Check how your version treats the status code before relying on it for a 404.

## 3. Hand a slow read to the client as a promise

```tsx
// server: start the read, do not await it
const relatedPromise = listRelatedProducts(product.id);
<Suspense fallback={<RelatedProductsSkeleton />}>
  <RelatedProducts relatedPromise={relatedPromise} />
</Suspense>;
```

```tsx
// client leaf
'use client';
import { use } from 'react';

export function RelatedProducts({
  relatedPromise,
}: {
  relatedPromise: Promise<readonly RelatedProductView[]>;
}) {
  const related = use(relatedPromise);
  return (
    <ul className="flex flex-col gap-2">
      {related.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

Why: the page streams without waiting for the related products, and the client component still gets the data. Never create the promise during a client render (`use(fetch(url))`): it is a new promise on every render, so the component re-suspends each time (react.dev, `use`: promises passed to `use` must be cached so the same instance is reused across re-renders). The resolved value must be serialisable, and `use` cannot sit in a `try`/`catch`: a rejected promise goes to the nearest error boundary (section 7).

## 4. A form is an Action: `useActionState` and a result union

```tsx
// before
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setIsLoading(true);
  const response = await fetch('/api/alerts', {
    method: 'POST',
    body: new FormData(event.currentTarget),
  });
  if (!response.ok) setError('Error');
  setIsLoading(false);
}
```

```ts
// src/features/alerts/alerts-types.ts
export type SetPriceAlertState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string; entered: string }
  | { status: 'failed'; message: string }
  | { status: 'saved'; maxPrice: number };
```

```ts
// src/features/alerts/alerts-schemas.ts: this subset accepts and rejects the same input on Zod 3 and Zod 4
import { z } from 'zod';

const wholeNumber = z.preprocess(
  // normalise first ("1,200" and " 1200 " both become "1200"; anything that is not text becomes ""), then validate
  (raw) => (typeof raw === 'string' ? raw.replace(/[,\s]/g, '') : ''),
  z
    .string()
    .regex(/^[1-9]\d{0,6}$/, 'Enter a whole number of 1 or more')
    .transform(Number),
);

export const setPriceAlertSchema = z.object({
  productId: z.string().min(1),
  maxPrice: wholeNumber,
});
```

```ts
// src/features/alerts/alerts-actions.ts
'use server';

import { updateTag } from 'next/cache';

import { setPriceAlertSchema } from '@/features/alerts/alerts-schemas';
import type { SetPriceAlertState } from '@/features/alerts/alerts-types';
import { upsertPriceAlert } from '@/features/alerts/server/alerts-mutations';

export async function setPriceAlertAction(
  _previous: SetPriceAlertState,
  formData: FormData,
): Promise<SetPriceAlertState> {
  const entered = formData.get('maxPrice');
  const parsed = setPriceAlertSchema.safeParse({
    productId: formData.get('productId'),
    maxPrice: entered,
  });
  if (!parsed.success) {
    return {
      status: 'invalid',
      message:
        parsed.error.issues[0]?.message ?? 'Check the price and try again',
      entered: typeof entered === 'string' ? entered : '',
    };
  }
  // the product, its current price and the owner (from the session) are looked up on the server, never taken from
  // the form; "alert me at or below N" is safe to repeat when a button is pressed twice
  const result = await upsertPriceAlert(
    parsed.data.productId,
    parsed.data.maxPrice,
  );
  if (result.kind === 'product-not-found')
    return { status: 'failed', message: 'This product is no longer available' };
  updateTag(`price-alert:${result.alertId}`);
  return { status: 'saved', maxPrice: result.maxPrice };
}
```

```tsx
// src/features/alerts/components/price-alert-form.tsx
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Spinner } from '@/components/ui/spinner';
import { setPriceAlertAction } from '@/features/alerts/alerts-actions';

function SaveButton() {
  const { pending } = useFormStatus(); // reads the parent <form>, so it must be a child component
  return (
    <button
      type="submit"
      aria-disabled={pending}
      data-pending={pending ? '' : undefined}
      // a second press while the first is in flight does nothing; aria-disabled alone does not stop clicks
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      // relative anchors the spinner overlay, and the horizontal padding leaves it room inside the button
      className="relative inline-flex min-h-11 items-center justify-center px-8"
    >
      Save alert
      {/* always rendered, and an overlay in the button's padding, so the label never moves, centred idle, pending
          and disabled; it turns only while pending (never shown mid-turn) and fades in after the pending delay, so
          a fast save never flashes it */}
      <Spinner />
    </button>
  );
}

export function PriceAlertForm({
  productId,
  initialMaxPrice,
}: {
  productId: string;
  initialMaxPrice: number;
}) {
  const [state, formAction] = useActionState(setPriceAlertAction, {
    status: 'idle',
  });
  const fieldId = `price-alert-${productId}`;
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor={fieldId}>Notify me at or below ($)</label>
      <input
        id={fieldId}
        name="maxPrice"
        type="text"
        inputMode="numeric"
        // React resets uncontrolled fields after an Action settles, also when it returns an invalid state: echo what
        // was typed, or a validation error would wipe the field
        defaultValue={
          state.status === 'invalid' ? state.entered : initialMaxPrice
        }
        aria-invalid={state.status === 'invalid'}
        aria-describedby={`${fieldId}-message`}
      />
      {/* the line is always there (one line box tall), so a message appearing never pushes the button down */}
      <p id={`${fieldId}-message`} role="status" className="min-block-lh">
        {state.status === 'invalid' || state.status === 'failed'
          ? state.message
          : null}
      </p>
      <SaveButton />
    </form>
  );
}
```

Why: "When a function is passed to `action` the function will handle the form submission in a Transition" (react.dev, `<form>`), so no `onSubmit`, no `preventDefault` and no `isLoading` state; with a Server Function the form also works before JavaScript loads. Expected failures come back as state and render next to the field; only unknown errors throw to `error.tsx` (Next.js error-handling guide: model expected errors as return values). React resets uncontrolled fields to their `defaultValue` once the Action settles, including when it returned an invalid state (checked with React 19.2.7), which is why the invalid state carries `entered`. `aria-disabled` rather than `disabled` keeps focus on the button while it is pending. The button keeps its label and width while pending (a label swap resizes it and moves its neighbours); the indicator waits for the pending delay (a token such as `--transition-delay-pending`, about 400 ms) so a fast save never flashes it. The action parses everything itself because it is a public endpoint (Next.js data-security guide).

`updateTag` is documented as part of the Cache Components model (its API reference also lists `fetch` tags as targets, so check what your version does without the flag). Without `cacheComponents`, the documented tools are the previous model's `revalidateTag` and `revalidatePath`, and `refresh()` for uncached data (all from `next/cache`, called inside the Action).

## 5. An optimistic stepper: `useOptimistic` inside the action, and the result still shown

```tsx
// src/features/alerts/components/price-alert-stepper.tsx
'use client';
import { useActionState, useOptimistic } from 'react';

import { setPriceAlertAction } from '@/features/alerts/alerts-actions';

type PriceAlertStepperProps = {
  productId: string;
  maxPrice: number;
  step: number;
};

const priceFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function PriceAlertStepper({
  productId,
  maxPrice,
  step,
}: PriceAlertStepperProps) {
  const [state, formAction] = useActionState(setPriceAlertAction, {
    status: 'idle',
  });
  const [shownPrice, setShownPrice] = useOptimistic(maxPrice);
  const atMinimum = shownPrice <= step;

  function changeTo(nextPrice: number) {
    return (formData: FormData) => {
      setShownPrice(nextPrice);
      formData.set('maxPrice', String(nextPrice));
      formAction(formData);
    };
  }

  return (
    <div className="flex flex-col gap-1">
      <form className="flex items-center gap-2">
        <input type="hidden" name="productId" value={productId} />
        <button
          type={atMinimum ? 'button' : 'submit'}
          formAction={atMinimum ? undefined : changeTo(shownPrice - step)}
          aria-disabled={atMinimum}
          aria-label="Lower the price limit"
          className="size-11 aria-disabled:opacity-60"
        >
          −
        </button>
        {/* tabular numerals and a box sized for the widest value ($9,999,999): the − and + buttons never move */}
        <output
          aria-live="polite"
          className="min-w-24 text-center tabular-nums"
        >
          {priceFormat.format(shownPrice)}
        </output>
        <button
          type="submit"
          formAction={changeTo(shownPrice + step)}
          aria-label="Raise the price limit"
          className="size-11"
        >
          +
        </button>
      </form>
      <p role="status" className="min-block-lh">
        {state.status === 'failed' || state.status === 'invalid'
          ? state.message
          : null}
      </p>
    </div>
  );
}
```

Why: the optimistic value shows at once and falls back to the server's `maxPrice` automatically when the Action settles, including when it fails. That fallback alone is silent, so the action's own result is rendered too: "This product is no longer available" explains why the number jumped back. Call the `useOptimistic` setter only inside an Action or Transition (react.dev). Use it where the outcome is predictable (a limit, a saved product), never for anything the server must confirm first. At the minimum the minus button stays focusable and says why through `aria-disabled` (a `disabled` button drops keyboard focus), and becomes a plain button so it submits nothing.

## 6. Cache a read, invalidate it after a write (Cache Components)

```ts
// src/features/catalog/server/catalog-queries.ts
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

import type { ProductCardView } from '@/features/catalog/catalog-types';
import {
  readProductsByCategory,
  toProductCardView,
} from '@/features/catalog/server/catalog-data';

export async function listCategoryProducts(
  categoryId: string,
): Promise<readonly ProductCardView[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(`category-products:${categoryId}`);
  const products = await readProductsByCategory(categoryId);
  return products.map(toProductCardView);
}
```

```ts
// in the Server Action that hides a product a shopper reported, after the write:
updateTag(`category-products:${categoryId}`);
```

Why: `'use cache'` with a profile and a tag makes the read part of the prerendered shell; `updateTag` in a Server Action gives read-your-writes (the next read waits for fresh data). Work that happens outside a request, such as an import job or a webhook from another system, calls a Route Handler that runs `revalidateTag(tag, 'max')`, the stale-while-revalidate form (Next.js caching and revalidating guides); `updateTag` works only inside Server Actions, and the one-argument `revalidateTag(tag)` is deprecated. The tag contains an id, never personal data. Cached functions take serialisable arguments and never read `cookies()`, `headers()` or `searchParams` inside; read those outside and pass the values in.

Without `cacheComponents`, `'use cache'`, `cacheLife` and `cacheTag` are not available. The bundled "Caching and Revalidating (Previous Model)" guide covers `fetch` cache options, `unstable_cache` and `revalidateTag`/`revalidatePath` for that setup.

## 7. Errors: a route boundary with a retry, component boundaries with `catchError`

```tsx
// src/app/categories/[slug]/error.tsx
'use client';

// Next.js 16.2: the prop is `unstable_retry`. (Next.js 16.3+) It is named `retry`.
export default function CategoryError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-xl font-bold">This category page did not load</h1>
      <p>
        We could not reach the server. Check your internet connection and try
        again.
      </p>
      <button
        type="button"
        className="min-h-12 px-4"
        onClick={() => {
          unstable_retry();
        }}
      >
        Try again
      </button>
    </main>
  );
}
```

```tsx
// src/features/catalog/components/product-results-error-boundary.tsx
'use client';
import { type ErrorInfo, unstable_catchError as catchError } from 'next/error';

// Next.js 16.2: `unstable_catchError`. (Next.js 16.3+) It is named `catchError`.
function ProductResultsFallback(_props: object, { unstable_retry }: ErrorInfo) {
  return (
    // the fallback reserves about the height of the skeleton it replaces, so the page does not jump
    <div role="alert" className="flex min-h-64 flex-col items-start gap-3 p-4">
      <p>The results did not load.</p>
      <button
        type="button"
        className="min-h-11 px-4"
        onClick={() => {
          unstable_retry();
        }}
      >
        Try again
      </button>
    </div>
  );
}

export const ProductResultsErrorBoundary = catchError(ProductResultsFallback);
```

Why: the retry function re-fetches and re-renders the segment inside a Transition, keeping client state outside the boundary (Next.js `error.js` docs). It was added as `unstable_retry` in 16.2.0, and `retry` (Next.js 16.3+) is the stable name from 16.3.0. `reset()` is still there for clearing the error without a re-fetch, which does not recover from a Server Component error. For one failing widget inside a page, wrap it with a component made by `catchError(Fallback)` from `next/error` (`unstable_catchError` since 16.2.0, `catchError` (Next.js 16.3+) from 16.3.0) instead of failing the whole route. `global-error.tsx` must render its own `<html>` and `<body>` and repeat what the root layout provides (`lang`, global styles, fonts).
