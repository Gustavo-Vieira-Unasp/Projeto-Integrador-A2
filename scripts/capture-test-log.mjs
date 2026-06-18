/**
 * Captura output de Jest dos testes C1 em docs/dashboard/evidencias/test-unit-c1.log
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'docs', 'dashboard', 'evidencias');
const outFile = join(outDir, 'test-unit-c1.log');

mkdirSync(outDir, { recursive: true });

const args = [
  'jest',
  'src/__tests__/apiService.test.js',
  'src/__tests__/observabilityService.test.js',
  '--verbose',
  '--no-coverage',
];

const result = spawnSync('npx', args, {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});

const header = `# Evidência C1 — test-unit-c1.log
# Gerado em: ${new Date().toISOString()}
# Comando: npx ${args.join(' ')}

`;
const body = (result.stdout || '') + (result.stderr || '');
const footer = `\n# Exit code: ${result.status ?? 'unknown'}\n`;

writeFileSync(outFile, header + body + footer, 'utf8');

console.log(`Log gravado em ${outFile}`);
process.exit(result.status ?? 1);
