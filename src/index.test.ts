import { describe, expect, it } from 'vitest';

import { VERSION } from './index.js';

describe('package entry point', () => {
  it('exposes a semver-shaped VERSION', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
