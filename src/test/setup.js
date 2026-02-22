import { beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: () => {},
});

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: () => {},
});

if (!window.HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
}


beforeEach(() => {
  window.localStorage.clear();
});
