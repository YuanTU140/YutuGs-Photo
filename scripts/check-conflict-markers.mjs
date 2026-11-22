import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', 'dist', 'target', '.tauri']);
const marker = /^\s*(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|)(?:\s|$)/;
const failures = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) await scan(join(directory, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const path = join(directory, entry.name);
    let content;
    try {
      content = await readFile(path, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\\r?\\n/);
    lines.forEach((line, index) => {
      if (marker.test(line)) failures.push(`${relative(root, path)}:${index + 1}: ${line.trim()}`);
    });
  }
}

await scan(root);
if (failures.length) {
  console.error('检测到未解决的 Git 合并冲突标记：');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log('冲突标记检查通过：未发现未解决的 Git 合并冲突标记。');
}
