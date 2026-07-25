import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['apps/web', 'packages/config', 'packages/database', 'supabase/functions'];
const ignoredDirectories = new Set(['node_modules', '.next', '.git', 'dist', 'coverage']);
const allowedLocalhostFiles = new Set([
  'apps/web/lib/deployment/site-url.ts',
  'apps/web/.env.example',
  '.env.example',
  'docs/deployment/LOCAL_SETUP.md',
]);

function walk(path) {
  const results = [];
  for (const entry of readdirSync(path)) {
    if (ignoredDirectories.has(entry)) continue;
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...walk(full));
    else if (/\.(?:ts|tsx|js|mjs|json|md)$/.test(entry)) results.push(full);
  }
  return results;
}

const files = scanRoots.flatMap((path) => walk(join(root, path)));
const envNames = new Set();
const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');

  for (const match of content.matchAll(/(?:process\.env\.|Deno\.env\.get\(['\"])([A-Z0-9_]+)/g)) {
    envNames.add(match[1]);
  }

  if (!allowedLocalhostFiles.has(name) && /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(content)) {
    violations.push(`${name}: contains a hardcoded localhost URL`);
  }

  if (/SUPABASE_SERVICE_ROLE_KEY/.test(content) && !name.includes('server') && !name.includes('admin') && !name.includes('recovery') && !name.startsWith('supabase/functions/')) {
    violations.push(`${name}: review service-role usage; it must remain server-only`);
  }
}

console.log('Environment variables referenced by deployment code:');
for (const name of [...envNames].sort()) console.log(`- ${name}`);

if (violations.length) {
  console.error('\nDeployment audit failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('\nDeployment environment audit passed.');
