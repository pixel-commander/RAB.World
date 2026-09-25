import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const SKIP_DIRS = new Set(['node_modules','.git','.rab','dist','build','.next','.cache','coverage','.vite','out','.turbo']);
export const CODE_EXTS = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
export const MARKUP_EXTS = new Set(['.html','.htm']);
export const STYLE_EXTS = new Set(['.css','.scss','.sass','.less']);
export const CONFIG_EXTS = new Set(['.json','.jsonc','.yaml','.yml','.toml','.ini','.conf','.config','.env']);
export const CONFIG_NAMES = new Set(['Dockerfile','dockerfile','.env','.env.local','.env.development','.env.production','.env.test']);
export const AUDIT_EXTS = new Set([...CODE_EXTS,...MARKUP_EXTS,...STYLE_EXTS,...CONFIG_EXTS]);

export const walkFiles = async (root, { onSkipped = () => {} } = {}) => {
  const out = [], stack = [path.resolve(root)];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = (await readdir(dir, { withFileTypes:true })).sort((a,b)=>a.name.localeCompare(b.name)); }
    catch (error) { onSkipped({ file:rel(root,dir) || '.', reason:'directory-read-error', code:error.code }); continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
        else onSkipped({ file:rel(root,full), reason:'excluded-directory' });
      } else if (entry.isFile()) out.push(full);
      else onSkipped({ file:rel(root,full), reason:entry.isSymbolicLink()?'symbolic-link':'unsupported-entry' });
    }
  }
  return out.sort((a,b)=>a.localeCompare(b));
};

export const walkFilesByExt = async (root, extensions = AUDIT_EXTS, options = {}) => {
  const allowed = extensions instanceof Set ? extensions : new Set(extensions);
  return (await walkFiles(root, options)).filter(file => allowed.has(path.extname(file).toLowerCase()) || (allowed.has('.env') && (CONFIG_NAMES.has(path.basename(file)) || path.basename(file).startsWith('.env.'))));
};

export const readText = async file => {
  try { return await readFile(file, 'utf8'); } catch { return ''; }
};

export const slash = value => String(value).replaceAll('\\','/');
export const rel = (root,file) => slash(path.relative(root,file));
export const lineNumberAt = (text,index) => text.slice(0,index).split(/\r?\n/).length;
