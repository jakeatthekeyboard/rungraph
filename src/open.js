import { spawn } from 'node:child_process';
import { dirname } from 'node:path';

/**
 * Best-effort browser open. Never throws; returns false on failure so the
 * caller can fall back to printing the URL (which it does anyway).
 */
export function openInBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.on('error', () => resolve(false));
      child.on('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Open a directory in the OS file manager: Finder on macOS, File Explorer on
 * Windows, the desktop's default elsewhere. The path goes in as an argv
 * entry, never through a shell. Resolves false when nothing could start.
 */
export function openFolder(dir) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [dir]]
      : process.platform === 'win32'
        ? ['explorer.exe', [dir]]
        : ['xdg-open', [dir]];
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.on('error', () => resolve(false));
      child.on('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Show a file selected in its folder: Finder (`open -R`), File Explorer
 * (`explorer /select,`), or the folder alone elsewhere. Argv only, no shell.
 */
export function revealFile(file) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', ['-R', file]]
      : process.platform === 'win32'
        ? ['explorer.exe', [`/select,${file}`]]
        : ['xdg-open', [dirname(file)]];
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
      child.on('error', () => resolve(false));
      child.on('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}
