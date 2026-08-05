import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = resolve('src');
const PROTECTED_SUBSYSTEMS = new Set(['content', 'render', 'wfc', 'world']);
const STATIC_IMPORT_PATTERN = /\bfrom\s+['"]([^'"]+)['"]/gu;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return extname(path) === '.ts' ? [path] : [];
    }),
  );

  return files.flat();
}

function subsystemFor(path: string): string | null {
  const [subsystem] = relative(SOURCE_ROOT, path).split(sep);
  return subsystem && PROTECTED_SUBSYSTEMS.has(subsystem) ? subsystem : null;
}

describe('subsystem boundaries', () => {
  it('routes protected subsystem imports through src/contracts', async () => {
    const violations: string[] = [];

    for (const file of await sourceFiles(SOURCE_ROOT)) {
      const sourceSubsystem = subsystemFor(file);
      if (!sourceSubsystem) continue;

      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
        const specifier = match[1];
        if (!specifier?.startsWith('.')) continue;

        const targetSubsystem = subsystemFor(resolve(dirname(file), specifier));
        if (targetSubsystem && targetSubsystem !== sourceSubsystem) {
          violations.push(
            `${relative(SOURCE_ROOT, file)} imports ${specifier}; use src/contracts instead`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
