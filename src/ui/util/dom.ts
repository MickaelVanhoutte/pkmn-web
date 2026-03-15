export function el(
  tag: string,
  attrs?: Record<string, string>,
  children?: (HTMLElement | string)[],
): HTMLElement {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}

export function text(content: string): Text {
  return document.createTextNode(content);
}

export function qs(selector: string, parent?: Element): HTMLElement | null {
  return (parent ?? document).querySelector<HTMLElement>(selector);
}

export function qsa(selector: string, parent?: Element): HTMLElement[] {
  return Array.from((parent ?? document).querySelectorAll<HTMLElement>(selector));
}

export function clearChildren(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function addDelegatedListener(
  parent: HTMLElement,
  eventType: string,
  selector: string,
  handler: (e: Event, target: HTMLElement) => void,
): () => void {
  const listener = (e: Event) => {
    const target = (e.target as HTMLElement | null)?.closest?.(selector) as HTMLElement | null;
    if (target && parent.contains(target)) {
      handler(e, target);
    }
  };

  parent.addEventListener(eventType, listener);

  return () => {
    parent.removeEventListener(eventType, listener);
  };
}
