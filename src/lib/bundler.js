let esbuildInitPromise = null

/**
 * Lazily initializes esbuild-wasm. The ~8MB WASM binary is loaded
 * on-demand the first time a user runs multi-file code with imports.
 * Subsequent calls reuse the initialized instance.
 */
async function ensureEsbuild() {
  if (!esbuildInitPromise) {
    esbuildInitPromise = (async () => {
      const esbuild = await import('esbuild-wasm')
      await esbuild.initialize({
        wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.4/esbuild.wasm',
      })
      return esbuild
    })()
  }

  try {
    return await esbuildInitPromise
  } catch (error) {
    esbuildInitPromise = null
    throw error
  }
}

/**
 * Infers the esbuild loader from a file path extension.
 */
function inferLoader(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const loaderMap = {
    js: 'js',
    mjs: 'js',
    cjs: 'js',
    jsx: 'jsx',
    ts: 'ts',
    tsx: 'tsx',
    css: 'css',
    json: 'json',
  }
  return loaderMap[ext] || 'js'
}

/**
 * Resolves a relative import path against a directory within the project file list.
 */
function resolveProjectPath(importPath, resolveDir, fileMap) {
  // Normalize: strip leading ./ and resolve against resolveDir
  let candidate = importPath.replace(/^\.\//, '')

  if (resolveDir && resolveDir !== '.' && !importPath.startsWith('/')) {
    const dir = resolveDir.replace(/\/$/, '')
    candidate = dir ? `${dir}/${candidate}` : candidate
  }

  // Try exact match first
  if (fileMap.has(candidate)) {
    return candidate
  }

  // Try with common extensions
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json']
  for (const ext of extensions) {
    if (fileMap.has(candidate + ext)) {
      return candidate + ext
    }
  }

  // Try index files in directory
  for (const ext of extensions) {
    const indexPath = `${candidate}/index${ext}`
    if (fileMap.has(indexPath)) {
      return indexPath
    }
  }

  return null
}

/**
 * Checks if code contains import/export/require statements that
 * suggest multi-file module resolution is needed.
 */
function hasModuleSyntax(code) {
  if (!code) {
    return false
  }

  return /\b(import\s+|from\s+['"]|export\s+|require\s*\()/.test(code)
}

/**
 * Bundles project files using esbuild-wasm with a virtual filesystem.
 * Returns { ok: true, code: string } on success, or { ok: false, errors: string[] } on failure.
 *
 * @param {Array<{path: string, content: string}>} files - Project files
 * @param {string} entryPoint - Entry file path (e.g. 'main.js')
 */
async function bundleProjectFiles(files, entryPoint) {
  try {
    const esbuild = await ensureEsbuild()

    const fileMap = new Map(files.map((f) => [f.path, f.content]))

    if (!fileMap.has(entryPoint)) {
      return {
        ok: false,
        errors: [`Entry point "${entryPoint}" not found in project files.`],
      }
    }

    const virtualFsPlugin = {
      name: 'virtual-fs',
      setup(build) {
        // Resolve all imports against the project file map
        build.onResolve({ filter: /.*/ }, (args) => {
          // External URLs pass through
          if (args.path.startsWith('http://') || args.path.startsWith('https://')) {
            return { external: true }
          }

          // Block path traversal
          if (args.path.includes('..')) {
            return { external: true }
          }

          const resolveDir = args.resolveDir || ''
          const resolved = resolveProjectPath(args.path, resolveDir, fileMap)

          if (resolved) {
            const lastSlash = resolved.lastIndexOf('/')
            return {
              path: resolved,
              namespace: 'project',
              pluginData: {
                resolveDir: lastSlash >= 0 ? resolved.slice(0, lastSlash) : '',
              },
            }
          }

          // Mark unresolvable imports as external rather than failing
          return { external: true }
        })

        // Load files from the virtual file map
        build.onLoad({ filter: /.*/, namespace: 'project' }, (args) => {
          const content = fileMap.get(args.path)
          if (content === undefined) {
            return { errors: [{ text: `File not found: ${args.path}` }] }
          }

          return {
            contents: content,
            loader: inferLoader(args.path),
            resolveDir: args.pluginData?.resolveDir || '',
          }
        })
      },
    }

    // Use stdin to avoid esbuild trying to resolve the entry from the real filesystem.
    // The entry content is fed directly, and imports are resolved through the virtual plugin.
    const entryContent = fileMap.get(entryPoint)
    const entryLastSlash = entryPoint.lastIndexOf('/')
    const entryDir = entryLastSlash >= 0 ? entryPoint.slice(0, entryLastSlash) : '.'

    const result = await esbuild.build({
      stdin: {
        contents: entryContent,
        loader: inferLoader(entryPoint),
        resolveDir: entryDir,
        sourcefile: entryPoint,
      },
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2020',
      plugins: [virtualFsPlugin],
      logLevel: 'silent',
    })

    if (result.errors && result.errors.length > 0) {
      return {
        ok: false,
        errors: result.errors.map((e) => e.text || String(e)),
      }
    }

    const outputText = result.outputFiles?.[0]?.text || ''
    return { ok: true, code: outputText }
  } catch (error) {
    return {
      ok: false,
      errors: [error.message || 'Bundling failed.'],
    }
  }
}

export { bundleProjectFiles, hasModuleSyntax }
