interface ObserverRecord {
  targets: Set<Element>;
  callback: IntersectionObserverCallback;
  instance: IntersectionObserver;
}

const activeObservers = new Set<ObserverRecord>();

/**
 * Installs a deterministic IntersectionObserver mock in jsdom.
 * By default elements do NOT auto-intersect; tests explicitly call
 * `triggerAllIntersections(true)` (or `triggerElementIntersection`) to simulate
 * scrolling into view.
 */
export function installIntersectionObserverMock(): void {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin: string;
    readonly scrollMargin: string;
    readonly thresholds: ReadonlyArray<number>;
    private readonly record: ObserverRecord;

    constructor(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit,
    ) {
      this.root = options?.root ?? null;
      this.rootMargin = options?.rootMargin ?? '0px';
      this.scrollMargin = '0px';
      const t = options?.threshold ?? 0;
      this.thresholds = Array.isArray(t) ? t : [t];
      this.record = {
        targets: new Set<Element>(),
        callback,
        instance: this,
      };
      activeObservers.add(this.record);
    }

    observe(target: Element): void {
      this.record.targets.add(target);
    }

    unobserve(target: Element): void {
      this.record.targets.delete(target);
    }

    disconnect(): void {
      this.record.targets.clear();
      activeObservers.delete(this.record);
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
}

export function resetIntersectionObserverMock(): void {
  activeObservers.clear();
}

export function getActiveIntersectionObserverCount(): number {
  return activeObservers.size;
}

export function triggerAllIntersections(isIntersecting: boolean): void {
  const snapshot = Array.from(activeObservers);
  for (const record of snapshot) {
    const targets = Array.from(record.targets);
    if (targets.length === 0) continue;

    const entries: IntersectionObserverEntry[] = targets.map((target) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      time: Date.now(),
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
    }));

    record.callback(entries, record.instance);
  }
}
