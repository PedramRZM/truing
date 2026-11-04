# Composition and the server/client boundary

The examples use one storefront app; the names and paths are illustrative.

## 1. `'use client'` goes on the leaf

Smell: a page or feature component marked `'use client'` because one button inside it needs a handler.

```tsx
// before: src/features/catalog/components/product-details.tsx
'use client';
export function ProductDetails({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false);
  return (
    <article>
      <h1>{product.name}</h1>
      <ProductGallery images={product.images} />
      <ProductDescription text={product.description} />
      {/* save button + price alert */}
    </article>
  );
}
```

```tsx
// after: the article stays a Server Component; only the interactive part is client code
export function ProductDetails({ product }: { product: ProductView }) {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{product.name}</h1>
      <ProductGallery images={product.images} />
      <ProductDescription text={product.description} />
      <SaveProductForm productId={product.id} initiallySaved={product.saved} />
    </article>
  );
}
```

Why: once a file says `'use client'`, it and everything it imports ship to the browser, and it can no longer read data on the server (Next docs; Abramov: `'use client'` is a typed `<script>`). The client leaf receives plain serialisable props (ids, numbers, strings), Server Functions and, as the next section shows, server-rendered UI as `children`.

## 2. Server-rendered UI through a client wrapper: `children`

Smell: a client component imports a server component, or the whole subtree becomes client code because its wrapper holds state.

```tsx
// after: the sheet owns open/closed; the list of brands is rendered on the server and passed in
'use client';
export function FilterSheet({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="min-h-11 px-4"
        onClick={() => dialogRef.current?.showModal()}
      >
        {title}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        className="w-full max-w-md p-4"
      >
        {children}
        <button
          type="button"
          className="min-h-11 px-4"
          onClick={() => dialogRef.current?.close()}
        >
          Close
        </button>
      </dialog>
    </>
  );
}

// in a Server Component
<FilterSheet title="Filters">
  <BrandFilterOptions brands={brands} />
</FilterSheet>;
```

Why: `children` is already-rendered output, so it crosses the boundary without becoming client code, and it is not re-rendered when the wrapper's state changes (Abramov, "Before You memo()"). The same move fixes slow typing: put the fast-changing state in a small component and pass the expensive part in as `children`. Native `<dialog>` gives focus trapping, Escape and the backdrop for free.

## 3. Context in React 19: provider component plus a hook that fails loudly

```tsx
'use client';
import { createContext, use, useState } from 'react';

type CartDrawer = { isOpen: boolean; open: () => void; close: () => void };

const CartDrawerContext = createContext<CartDrawer | null>(null);

export function CartDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const drawer: CartDrawer = {
    isOpen,
    open: () => {
      setIsOpen(true);
    },
    close: () => {
      setIsOpen(false);
    },
  };
  return <CartDrawerContext value={drawer}>{children}</CartDrawerContext>;
}

export function useCartDrawer() {
  const drawer = use(CartDrawerContext);
  if (drawer === null)
    throw new Error('useCartDrawer must be used inside <CartDrawerProvider>');
  return drawer;
}
```

Why: React 19 renders `<Context value>` directly and reads it with `use` ("`SomeContext.Provider` is a legacy way", react.dev); a lint rule can reject the old forms. The raw context is not exported, and the hook throws outside its provider, so a missing provider fails at the first render instead of later with `undefined` (Dodds, "How to use React Context effectively", paraphrased). Context is transport, not state management (Erikson): one context per concern, the provider as deep as it can go, and prefer passing props or `children` when only one or two levels need the value.

Memoisation: with the React Compiler on (`reactCompiler: true`), `drawer` needs no `useMemo`. Without it the object is new on every provider render, so every consumer re-renders whenever the provider does; react.dev calls wrapping the value in `useMemo` (and its functions in `useCallback`) a performance optimisation, so add them when a measurement shows the cost.

## 4. Props for data, compound components only for layout freedom

```tsx
// after: the sizes come from data, so they are a prop
<SizePicker label="Size" options={product.sizes} selectedId={selectedSizeId} />
```

Why: a list that comes from data is a prop; compound components (`<Tabs><Tabs.Tab/></Tabs>`) earn their place only when callers need to arrange the parts themselves (TkDodo, 2026-01-02). Static members such as `Menu.Item` do not survive the server/client boundary.

## 5. A pattern component that cannot be used wrongly

Smell: icon-only buttons without an accessible name; a generic `Tooltip` bolted on later.

```tsx
type IconButtonProps = Omit<
  React.ComponentProps<'button'>,
  'aria-label' | 'children' | 'type'
> & {
  label: string;
  icon: React.ReactNode;
};

export function IconButton({
  label,
  icon,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex size-11 items-center justify-center ${className ?? ''}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
```

Why: making `label` required turns an accessibility rule into a type error (TkDodo, design-system principles, 2025-11-17). `size-11` is the 44 px touch target; `ref` arrives through `ComponentProps<'button'>` in React 19, so no `forwardRef`. `ui-craft.md` section 5 adds the tooltip to this component.

## 6. Keep unrelated state apart; lift only as far as needed

```tsx
// before: the page owns every piece of UI state, so typing in the search box re-renders every result
// after: SearchBox owns its text; the results read the submitted query from the URL on the server
<SearchBox defaultQuery={query} />   {/* client: local text, submits a GET form */}
<ProductList products={products} /> {/* server: rendered from the query in searchParams */}
```

Why: global and far-lifted state is a leading cause of slow React apps (Dodds, "State Colocation"). Ask whether rendering the component twice should show the interaction in both copies (Abramov); if not, it is local state. Search and filters belong in the URL so Back works and results can be shared.
