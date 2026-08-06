import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { zipSync } from 'fflate';

async function collectFiles(
  root: string,
  directory = root,
  output: Record<string, Uint8Array> = {},
): Promise<Record<string, Uint8Array>> {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const details = await stat(path);
    if (details.isDirectory()) await collectFiles(root, path, output);
    else
      output[relative(root, path).replaceAll('\\', '/')] = await readFile(path);
  }
  return output;
}

const files = await collectFiles('dist');
const archive = zipSync(files, { level: 9 });
const hash = createHash('sha256').update(archive).digest('hex');
await mkdir('release', { recursive: true });
const archivePath = 'release/la-ultima-observacion-rc.zip';
await writeFile(archivePath, archive);
await writeFile(
  'release/manifest.json',
  `${JSON.stringify(
    {
      archive: archivePath,
      sha256: hash,
      bytes: archive.byteLength,
      files: Object.keys(files).sort(),
      offline: true,
      runtimeNetworkRequests: 0,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`${archivePath}\nsha256 ${hash}\n`);
