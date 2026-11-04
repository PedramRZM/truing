# State and effects

Each pattern: the smell, the code an agent usually writes, the code to write instead, and why. The examples use one storefront app (products, collections, a cart); the names are illustrative.

What replaces an effect, by need:

| You wrote an effect to...                           | Write this instead             | Section |
| --------------------------------------------------- | ------------------------------ | ------- |
| copy or compute a value from props or state         | compute it during render       | 1       |
| reset state when a prop changes                     | give the subtree a `key`       | 2       |
| react to something the user did                     | do it in the handler or Action | 3       |
| read the latest value inside a subscription         | `useEffectEvent` (React 19.2)  | 4       |
| mirror a browser value (online status, media query) | `useSyncExternalStore`         | 7       |

## 1. Derive, don't sync

Smell: a `useState` whose setter is only called from a `useEffect` (TkDodo: remove that state).

```tsx
// before
const [onSaleCount, setOnSaleCount] = useState(0);
const [hasCheaperVariant, setHasCheaperVariant] = useState(false);
useEffect(() => {
  setOnSaleCount(products.filter((product) => product.onSale).length);
  setHasCheaperVariant(
    variants.some((variant) => variant.price < product.price),
  );
}, [products, variants, product.price]);
```

```tsx
// after
const onSaleCount = products.filter((product) => product.onSale).length;
const hasCheaperVariant = variants.some(
  (variant) => variant.price < product.price,
);
```

Why: the effect version renders once with stale numbers, then again. "When something can be calculated from the existing props or state, don't put it in state. Instead, calculate it during rendering" (react.dev). The same goes for filtered lists, counts, labels and "is valid" flags. Memoisation: with the React Compiler on (`reactCompiler: true`) the calculation is memoised for you, so there is no `useMemo` either. Without the compiler a plain calculation is still the right default; reach for `useMemo` only when a measurement shows the calculation is slow.

## 2. Reset with a key, not an effect

Smell: an effect that copies a prop into state when the prop changes.

```tsx
// before
function CollectionForm({ collection }: { collection: Collection }) {
  const [name, setName] = useState(collection.name);
  useEffect(() => {
    setName(collection.name);
  }, [collection.name]);
  // …
}
```

```tsx
// after: the parent decides when the form starts over
<CollectionForm
  key={collection.id}
  initialName={collection.name}
  action={renameCollectionAction}
/>;

type CollectionFormProps = {
  initialName: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function CollectionForm({ initialName, action }: CollectionFormProps) {
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="collection-name">Collection name</label>
      <input id="collection-name" name="name" defaultValue={initialName} />
      <button type="submit">Save</button>
    </form>
  );
}
```

Why: "You can force a subtree to reset its state by giving it a different key" (react.dev). Copying a prop into state ignores every later update to it (Abramov, "Writing Resilient Components"); an intentional starting value is named `initialX`. A form submitted through an Action needs no state at all: named inputs with `defaultValue`.

## 3. What the user did belongs in the handler

Smell: state that exists only so an effect can react to a click.

```tsx
// before
const [saved, setSaved] = useState(false);
useEffect(() => {
  if (saved) {
    announce(SAVED_MESSAGE);
    onSaved(product.id);
  }
}, [saved, onSaved, product.id]);
// <button onClick={() => setSaved(true)}>…
```

```tsx
// after
function handleSave() {
  announce(SAVED_MESSAGE);
  onSaved(product.id);
}
// <button type="button" onClick={handleSave}>{SAVE_LABEL}</button>
```

Why: react.dev, "Sharing logic between event handlers": code that runs because of an interaction goes in the handler. The effect version fires again on remount and, in development, twice, and it is one render late.

## 4. `useEffectEvent` instead of silencing `exhaustive-deps`

Smell: `// eslint-disable-next-line react-hooks/exhaustive-deps`, or a `latestRef.current = value` assignment, to read a value without re-subscribing.

```tsx
// before
useEffect(() => {
  const subscription = subscribeToStock(productId, (unitsLeft) => {
    if (unitsLeft <= notifyBelow) showLowStockNotice(unitsLeft, productName);
  });
  return () => {
    subscription.close();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [productId]);
```

```tsx
// after (React 19.2)
const onStockChange = useEffectEvent((unitsLeft: number) => {
  if (unitsLeft <= notifyBelow) showLowStockNotice(unitsLeft, productName);
});

useEffect(() => {
  const subscription = subscribeToStock(productId, (unitsLeft) => {
    onStockChange(unitsLeft);
  });
  return () => {
    subscription.close();
  };
}, [productId]);
```

Why: the subscription depends only on `productId`; the threshold and the product name are read fresh when an update arrives. Effect Events "can only be called from inside Effects or other Effect Events" (react.dev): never list them in dependencies, never pass them to children, call them from a wrapper inside the effect.

Version: `useEffectEvent` ships in React 19.2 (it is exported by `react@19.2.7`). On an older React, do not silence the rule: move the logic into the handler, or make the effect depend on the primitive it needs.

## 5. A union instead of boolean flags

Smell: `isLoading`, `isError`, `data` that can all be set at once.

```tsx
// before
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [quote, setQuote] = useState<ShippingQuote | null>(null);
```

```tsx
// after
type QuoteState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ready'; quote: ShippingQuote }
  | { status: 'failed'; message: string };

export function ShippingQuotePanel({ state }: { state: QuoteState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'pending':
      return <ShippingQuoteSkeleton />;
    case 'failed':
      return <p role="alert">{state.message}</p>;
    case 'ready':
      return <ShippingQuoteSummary quote={state.quote} />;
  }
}
```

Why: three booleans allow eight combinations, most of them impossible and untested (Dodds, "Stop using isLoading booleans"; TkDodo on the first boolean prop). With typed lint rules on, `switch-exhaustiveness-check` reports a missing case. With Actions, `useActionState` already gives you `isPending`; model the rest of the result as a union.

## 6. A reducer named after events

Smell: several setters called together in every handler.

```tsx
// after: a filter sheet keeps a draft until the shopper presses "Apply"
type FilterDraft = { brandIds: readonly string[]; inStockOnly: boolean };
type FilterEvent =
  | { type: 'brandToggled'; brandId: string }
  | { type: 'inStockOnlyToggled' }
  | { type: 'cleared' };

export function filterDraftReducer(
  draft: FilterDraft,
  event: FilterEvent,
): FilterDraft {
  switch (event.type) {
    case 'brandToggled':
      return draft.brandIds.includes(event.brandId)
        ? {
            ...draft,
            brandIds: draft.brandIds.filter((id) => id !== event.brandId),
          }
        : { ...draft, brandIds: [...draft.brandIds, event.brandId] };
    case 'inStockOnlyToggled':
      return { ...draft, inStockOnly: !draft.inStockOnly };
    case 'cleared':
      return { brandIds: [], inStockOnly: false };
  }
}
// const [draft, dispatch] = useReducer(filterDraftReducer, initialDraft);
```

Why: "state that updates together should live together", and actions describe what happened, not which setter to call (TkDodo). A pure reducer is also the easiest thing in the app to unit test. Independent values stay separate `useState` calls (Dodds). Applied filters live in the URL, not in state.

## 7. An external store without a hydration mismatch

Smell: `useState(navigator.onLine)` plus an effect adding listeners (crashes on the server, mismatches on hydration).

```tsx
// after
function subscribeToConnection(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useIsOnline() {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true, // the server assumes online; the client corrects it after hydration
  );
}
```

Why: `useSyncExternalStore` is React's API for values that live outside React, and its third argument gives the server and the first client render the same snapshot (react.dev; TkDodo, "Avoiding Hydration Mismatches with useSyncExternalStore"). Use it for connectivity, media queries that CSS cannot express, and storage. `ui-craft.md` section 7 uses it for the reduced-motion preference.
