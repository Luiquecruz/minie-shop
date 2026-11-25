import { useEffect, useRef, useState, type RefObject } from 'react';

export interface UseInViewOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

export interface UseInViewResult<TElement extends Element> {
  ref: RefObject<TElement | null>;
  hasIntersected: boolean;
}

/**
 * Latched IntersectionObserver hook: starts `false` and flips once to `true`
 * when the target element enters (or approaches via `rootMargin`) the viewport.
 */
export function useInView<TElement extends Element = HTMLDivElement>({
  rootMargin = '200px 0px',
  threshold = 0,
}: UseInViewOptions = {}): UseInViewResult<TElement> {
  const ref = useRef<TElement | null>(null);
  const [hasIntersected, setHasIntersected] = useState<boolean>(
    () => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    if (hasIntersected) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasIntersected(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [hasIntersected, rootMargin, threshold]);

  return { ref, hasIntersected };
}
