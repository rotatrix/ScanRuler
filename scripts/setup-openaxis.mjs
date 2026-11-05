// Build the exact SDK source used by this prototype, without vendoring it.
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
const revision = '8f8b5e50e6eb1f3b15e2bd6ebaccc6208ce50bcc'
const root = resolve(import.meta.dirname, '..')
const source = resolve(process.argv[2] ?? `${root}/.openaxis/source`)
const run = (command, args, cwd) => {
  if (process.platform !== 'win32' || command === 'git') return execFileSync(command, args, { cwd, stdio: 'inherit' })
  // pnpm is a cmd shim on Windows. Quote each argument, refusing shell syntax.
  if (args.some(arg => /["%&|<>^!\r\n]/.test(arg))) throw new Error('Unsupported shell character in SDK path')
  return execFileSync(`${command} ${args.map(arg => `"${arg}"`).join(' ')}`, { cwd, stdio: 'inherit', shell: true })
}
if (!process.argv[2] && !existsSync(source)) {
  mkdirSync(resolve(root, '.openaxis'), { recursive: true })
  run('git', ['clone', 'https://github.com/rotatrix/openaxis.git', source], root)
  run('git', ['checkout', '--detach', revision], source)
}
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim()
if (actual !== revision) throw new Error(`Expected OpenAxis ${revision}, got ${actual}`)
if (execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' }).trim()) throw new Error('SDK checkout must be clean')
run('pnpm', ['install', '--frozen-lockfile'], source)
run('pnpm', ['-C', 'ts/sdk', 'build'], source)
const output = resolve(root, '.openaxis/sdk')
mkdirSync(output, { recursive: true })
for (const file of ['dist', 'package.json', 'README.md', 'LICENSE', 'LEGAL.md']) cpSync(resolve(source, 'ts/sdk', file), resolve(output, file), { recursive: true })
const notices = resolve(root, 'public/licenses/openaxis')
mkdirSync(notices, { recursive: true })
for (const file of ['LICENSE', 'LEGAL.md']) cpSync(resolve(output, file), resolve(notices, file))
console.log(`Prepared ${JSON.parse(readFileSync(resolve(output, 'package.json'))).name} at ${revision}. Run npm ci --install-links.`)
