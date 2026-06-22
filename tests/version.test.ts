import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from '../src/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Server version', () => {
  it('VERSION matches package.json (no drift between advertised and published version)', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    expect(VERSION).toBe(pkg.version);
  });

  it('VERSION is a non-empty semver-ish string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
