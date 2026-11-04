// Fast Refresh, seen from the probe. React Refresh asks each renderer to
// re-render through `scheduleRefresh`, on the object the renderer gives the
// DevTools hook (bippy's, installed before the page's scripts). Wrapping it
// there tells the probe that code changed, without touching the app.
type Renderer = { scheduleRefresh?: (...args: unknown[]) => unknown };
type Hook = {
  renderers?: Map<number, Renderer>;
  inject?: (renderer: Renderer) => number;
};

const wrapped = new WeakSet<Renderer>();

export function onFastRefresh(callback: () => void): void {
  const hook = (globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: Hook })
    .__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return;

  const wrap = (renderer: Renderer): void => {
    const original = renderer.scheduleRefresh;
    if (typeof original !== 'function' || wrapped.has(renderer)) return;
    wrapped.add(renderer);
    renderer.scheduleRefresh = function scheduleRefresh(...args: unknown[]) {
      callback();
      return original.apply(this, args);
    };
  };

  for (const renderer of hook.renderers?.values() ?? []) wrap(renderer);
  const inject = hook.inject;
  if (typeof inject !== 'function') return;
  hook.inject = function injectRenderer(renderer: Renderer) {
    wrap(renderer);
    return inject.call(this, renderer);
  };
}
