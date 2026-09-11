/**
 * Resolve hook so plain `node scripts/*.ts` can import the app's TS sources
 * directly (they use extension-less relative imports, which Node ESM
 * rejects). Registered via: node --import ./scripts/register-ts.mjs
 * Type stripping is native in Node ≥23.6 — this only fixes RESOLUTION.
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return nextResolve(specifier, context)
  }
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    // only retry extension-less RELATIVE specifiers (the app's style)
    if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) throw err
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd()
    const base = path.dirname(parentPath)
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`, specifier]) {
      try {
        return await nextResolve(pathToFileURL(path.join(base, candidate)).href, context)
      } catch { /* try next */ }
    }
    throw err
  }
}
