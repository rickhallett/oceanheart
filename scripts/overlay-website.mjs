import { cp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('website/dist/client');
const destination = path.resolve('public');
await stat(path.join(source, 'index.html'));

// Remove Hugo directory indexes only where the new export supplies that route.
async function removeReplacedIndexes(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) await removeReplacedIndexes(path.join(directory, entry.name), name);
    else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
      await rm(path.join(destination, name.slice(0, -5), 'index.html'), { force: true });
    }
  }
}
await removeReplacedIndexes(source);
await cp(source, destination, { recursive: true, force: true });
