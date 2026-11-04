// Editing text in place (TRU-4.1): a double-click on an
// element that holds only text makes it editable in the frame. Enter, a
// click elsewhere or leaving the frame keeps the new text; Esc drops it.
// Either way the element gets its own text node back, the one React owns:
// what the designer typed reaches the page through the Changes tray's
// preview, so Undo, Discard and the hot reload after Apply all work on
// React's node, never on one the browser made while typing.

export type InlineText = {
  /** Starts editing the element; false if it doesn't hold only text. */
  start: (element: Element) => boolean;
  /** Keeps what was typed, if anything is being edited. */
  commit: () => void;
  /** Drops what was typed, if anything is being edited. */
  cancel: () => void;
  editing: () => Element | null;
};

export function createInlineText(options: {
  /** The element's new text, when it differs from what it said. */
  onCommit: (element: Element, text: string, before: string) => void;
}): InlineText {
  let current: {
    element: HTMLElement;
    original: string;
    nodes: ChildNode[];
    attribute: string | null;
    stop: () => void;
  } | null = null;

  function finish(keep: boolean): void {
    if (!current) return;
    const { element, original, nodes, attribute, stop } = current;
    current = null;
    // What was typed, before the nodes get their own text back.
    const typed = (element.textContent ?? '').replace(/\s*\n\s*/g, ' ');
    stop();
    element.replaceChildren(...nodes);
    if (attribute === null) element.removeAttribute('contenteditable');
    else element.setAttribute('contenteditable', attribute);
    if (keep && typed.trim() !== '' && typed.trim() !== original.trim()) {
      options.onCommit(element, typed, original);
    }
  }

  return {
    start(element) {
      if (!(element instanceof HTMLElement)) return false;
      if (element.children.length > 0) return false;
      const original = element.textContent ?? '';
      if (original.trim() === '') return false;
      finish(true);

      const nodes = [...element.childNodes];
      const texts = nodes.map((node) => node.textContent);
      const attribute = element.getAttribute('contenteditable');
      element.setAttribute('contenteditable', 'plaintext-only');

      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      };
      const onBlur = (): void => finish(true);
      element.addEventListener('keydown', onKey);
      element.addEventListener('blur', onBlur);
      current = {
        element,
        original,
        nodes,
        attribute,
        stop: () => {
          element.removeEventListener('keydown', onKey);
          element.removeEventListener('blur', onBlur);
          // The nodes' text as it was, before the browser edited them in place.
          nodes.forEach((node, index) => {
            const text = texts[index];
            if (text !== undefined && text !== null) node.textContent = text;
          });
        },
      };

      element.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    },
    commit: () => finish(true),
    cancel: () => finish(false),
    editing: () => current?.element ?? null,
  };
}
