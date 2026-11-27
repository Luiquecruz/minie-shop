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

if (typeof HTMLDialogElement !== 'undefined') {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== 'function') {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
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
