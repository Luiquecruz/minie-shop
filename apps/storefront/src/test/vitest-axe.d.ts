import type { AxeMatchers } from 'vitest-axe/dist/matchers';

declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends AxeMatchers {
    toHaveNoViolations(): R;
  }
}
