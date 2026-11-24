import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect } from 'vitest';
import 'vitest-axe/extend-expect';
import * as axeMatchers from 'vitest-axe/matchers';
import {
  installIntersectionObserverMock,
  resetIntersectionObserverMock,
} from './intersectionObserverMock';

expect.extend(axeMatchers);

installIntersectionObserverMock();

if (
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.scrollIntoView !== 'function'
) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  installIntersectionObserverMock();
});

afterEach(() => {
  cleanup();
  resetIntersectionObserverMock();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});
