/**
 * Session persistence store abstraction.
 *
 * Decouples TUI session persistence from `node:fs` so callers and tests can
 * swap implementations — for example an in-memory store for hermetic tests or
 * a future remote store — without environment sniffing or touching disk.
 *
 * Reference: TF-0MN1QCTMC07ATYMS (Introduce SessionStore DI for TUI session
 * persistence).
 */

import {
  copyFile,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Minimal asynchronous file operations required by session persistence.
 *
 * Every method is asynchronous so the adapter can be backed by
 * `node:fs/promises`, an in-memory map, or a remote service.
 */
export interface SessionStore {
  /** Read a file as UTF-8 text. Rejects when the file does not exist. */
  readFile(filePath: string): Promise<string>;

  /** Write UTF-8 text to a file, creating or truncating it. */
  writeFile(filePath: string, content: string): Promise<void>;

  /** Resolve to true when the path exists, false otherwise. */
  exists(filePath: string): Promise<boolean>;

  /** Remove a file. Rejects when the file does not exist. */
  unlink(filePath: string): Promise<void>;

  /** Copy a file from `source` to `destination`. */
  copyFile(source: string, destination: string): Promise<void>;

  /** List the entry names directly contained in a directory. */
  readdir(dirPath: string): Promise<string[]>;
}

/**
 * Default SessionStore backed by `node:fs/promises`.
 *
 * Used in production by the TUI wizard; tests inject an in-memory
 * implementation instead so they never read or write a developer's session
 * file.
 */
export class NodeFsSessionStore implements SessionStore {
  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, "utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, "utf-8");
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async unlink(filePath: string): Promise<void> {
    await unlink(filePath);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    await copyFile(source, destination);
  }

  async readdir(dirPath: string): Promise<string[]> {
    return readdir(dirPath);
  }
}

/**
 * In-memory SessionStore for hermetic tests.
 *
 * Keeps every path (normalised to absolute) and its UTF-8 content in a Map so
 * tests exercise the real persistence logic without touching disk. Directory
 * existence and listing are derived from the stored file paths.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly files = new Map<string, string>();

  private static normalise(filePath: string): string {
    return resolve(filePath);
  }

  private static enoent(operation: string, filePath: string): NodeJS.ErrnoException {
    const err = new Error(
      `ENOENT: no such file or directory, ${operation} '${filePath}'`,
    ) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    return err;
  }

  async readFile(filePath: string): Promise<string> {
    const key = InMemorySessionStore.normalise(filePath);
    const content = this.files.get(key);
    if (content === undefined) {
      throw InMemorySessionStore.enoent("open", filePath);
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files.set(InMemorySessionStore.normalise(filePath), content);
  }

  async exists(filePath: string): Promise<boolean> {
    const key = InMemorySessionStore.normalise(filePath);
    if (this.files.has(key)) return true;
    // Treat a path as an existing directory when it is a prefix of any stored
    // file, mirroring `stat()` on a real directory.
    const prefix = key.endsWith("/") ? key : `${key}/`;
    for (const stored of this.files.keys()) {
      if (stored.startsWith(prefix)) return true;
    }
    return false;
  }

  async unlink(filePath: string): Promise<void> {
    const key = InMemorySessionStore.normalise(filePath);
    if (!this.files.delete(key)) {
      throw InMemorySessionStore.enoent("unlink", filePath);
    }
  }

  async copyFile(source: string, destination: string): Promise<void> {
    const content = await this.readFile(source);
    this.files.set(InMemorySessionStore.normalise(destination), content);
  }

  async readdir(dirPath: string): Promise<string[]> {
    const key = InMemorySessionStore.normalise(dirPath);
    const prefix = key.endsWith("/") ? key : `${key}/`;
    const names = new Set<string>();
    for (const stored of this.files.keys()) {
      if (!stored.startsWith(prefix)) continue;
      const name = stored.slice(prefix.length).split("/")[0];
      if (name) names.add(name);
    }
    if (names.size === 0 && !(await this.exists(key))) {
      throw InMemorySessionStore.enoent("scandir", dirPath);
    }
    return [...names];
  }
}
