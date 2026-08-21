// Database client — PrismaClient singleton.
//
// IMPORTANT — Next.js 16 Turbopack dev-server caveat:
// Turbopack caches the `@prisma/client` external module in-memory at first
// load. If the Prisma schema changes (e.g. a new model is added) and
// `prisma generate` is run AFTER the dev server has already started, the
// dev server keeps serving the OLD PrismaClient class — new models (like
// `db.folder`) are undefined on the cached instance.
//
// To work around this, we don't `require('@prisma/client')` directly. Instead
// we read the freshly-generated `.prisma/client/index.js` source from disk
// and evaluate it in a fresh Node.js module function via `vm.runInThisContext`.
// We pass a custom `require` for nested imports so the entire generated
// client tree loads from disk, bypassing Turbopack's cache entirely.
//
// In production (Node.js without Turbopack) the regular `require` works
// fine; the disk-loader simply produces an equivalent PrismaClient.

const genClientPath = `${process.cwd()}/node_modules/.prisma/client/index.js`

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const fs: typeof import('fs') = require('fs')
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const path: typeof import('path') = require('path')
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const vm: typeof import('vm') = require('vm')
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const Module: any = require('module')

type PrismaClientLike = {
  // We don't enumerate every model here — `db.folder`, `db.project`, etc. are
  // accessed dynamically. The `unknown` index signature lets TypeScript
  // accept arbitrary model access.
  [model: string]: unknown
  $disconnect: () => Promise<unknown>
  $connect: () => Promise<unknown>
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientLike | undefined
  __prismaBuildKey?: string
}

// Bump this when regenerating the Prisma Client (after schema changes that
// introduce new models). This invalidates the cached singleton.
const PRISMA_BUILD_KEY = 'v1-folder-schema'

function loadPrismaClientFromDisk(): new (opts?: unknown) => PrismaClientLike | undefined {
  if (!fs.existsSync(genClientPath)) return undefined
  const src = fs.readFileSync(genClientPath, 'utf8')
  const wrappedSrc = Module.wrap(src)

  // Custom require: load nested modules from disk by reading their source
  // and evaluating them with `vm.runInThisContext` + `Module.wrap`.
  // Built-in modules (fs, path, etc.) are delegated to the regular require
  // via `process.mainModule.require` (which Turbopack doesn't intercept).
  const contextRequire = (id: string) => {
    const isBuiltin =
      id.startsWith('node:') ||
      (!id.startsWith('.') && !id.startsWith('/') && !id.includes('@prisma') && !id.includes('.prisma'))
    if (isBuiltin) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const main = (process as any).mainModule
      if (main?.require) return main.require(id)
      try {
        const createRequire = Module.createRequire
        if (createRequire) {
          const req = createRequire(genClientPath)
          return req(id)
        }
      } catch {
        /* ignore */
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(id)
    }
    const resolvedPath = Module._resolveFilename
      ? Module._resolveFilename(id, {
          filename: genClientPath,
          paths: Module._nodeModulePaths(path.dirname(genClientPath)),
        })
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      : require.resolve(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = require.cache as any
    if (cache[resolvedPath]) return cache[resolvedPath].exports
    const subSrc = fs.readFileSync(resolvedPath, 'utf8')
    const subWrapped = Module.wrap(subSrc)
    const subModule: { exports: Record<string, unknown> } = { exports: {} }
    const subFn = vm.runInThisContext(subWrapped, { filename: resolvedPath }) as
      (exports: Record<string, unknown>, require: NodeRequire, module: { exports: Record<string, unknown> }, filename: string, dirname: string) => void
    subFn.call(
      subModule.exports,
      subModule.exports,
      contextRequire as unknown as NodeRequire,
      subModule,
      resolvedPath,
      path.dirname(resolvedPath),
    )
    cache[resolvedPath] = { exports: subModule.exports }
    return subModule.exports
  }

  const fakeModule: { exports: Record<string, unknown> } = { exports: {} }
  const compiledFn = vm.runInThisContext(wrappedSrc, { filename: genClientPath }) as
    (exports: Record<string, unknown>, require: NodeRequire, module: { exports: Record<string, unknown> }, filename: string, dirname: string) => void
  compiledFn.call(
    fakeModule.exports,
    fakeModule.exports,
    contextRequire as unknown as NodeRequire,
    fakeModule,
    genClientPath,
    path.dirname(genClientPath),
  )
  const exported = fakeModule.exports as { PrismaClient?: new (opts?: unknown) => PrismaClientLike }
  return exported.PrismaClient
}

// Drop the cached PrismaClient instance when the build key changes.
if (
  process.env.NODE_ENV !== 'production' &&
  globalForPrisma.__prismaBuildKey !== PRISMA_BUILD_KEY
) {
  if (globalForPrisma.prisma) {
    try { globalForPrisma.prisma.$disconnect() } catch { /* ignore */ }
  }
  globalForPrisma.prisma = undefined
  globalForPrisma.__prismaBuildKey = PRISMA_BUILD_KEY
}

// Try to load the freshly-generated PrismaClient from disk (Turbopack
// workaround). Fall back to a regular require if disk-loading fails (e.g.
// in production where the file may not exist at the expected path).
let PrismaClient: new (opts?: { log?: ('query' | 'info' | 'warn' | 'error')[] }) => PrismaClientLike
const fromDisk = loadPrismaClientFromDisk()
if (fromDisk) {
  PrismaClient = fromDisk
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@prisma/client') as { PrismaClient: new (opts?: { log?: ('query' | 'info' | 'warn' | 'error')[] }) => PrismaClientLike }
  PrismaClient = mod.PrismaClient
}

export const db: PrismaClientLike =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
