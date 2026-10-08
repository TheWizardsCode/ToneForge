/**
 * ToneForge Memory — append-only, project-local JSONL store.
 *
 * The store writes one JSON object per line to
 * `.toneforge/memory/memory.jsonl` (PRD §4.3, §6). Writes are append-only:
 * existing records are never mutated or deleted by an append. `clear()` is
 * the only destructive operation and must be invoked explicitly.
 *
 * Persistence goes through an injectable {@link MemoryFileSystem} so tests
 * run hermetically (in-memory) while production uses `node:fs/promises`.
 * The store is project-local by construction: it only ever touches the
 * directory it is given.
 */

import {
  appendFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  MEMORY_DIR_PARTS,
  MEMORY_FILE_NAME,
  parseMemoryRecord,
  serialiseMemoryRecord,
} from "./types.js";
import type { MemoryRecord } from "./types.js";

/** Minimal asynchronous file operations required by the Memory store. */
export interface MemoryFileSystem {
  /** Read a file as UTF-8 text. Rejects when the file does not exist. */
  readFile(filePath: string): Promise<string>;

  /** Write UTF-8 text, creating or truncating the file. */
  writeFile(filePath: string, content: string): Promise<void>;

  /** Append UTF-8 text to a file. */
  appendFile(filePath: string, content: string): Promise<void>;

  /** Create a directory (recursively). */
  mkdir(dirPath: string): Promise<void>;

  /** Resolve to true when the path exists. */
  exists(filePath: string): Promise<boolean>;
}

/** Default {@link MemoryFileSystem} backed by `node:fs/promises`. */
export class NodeMemoryFileSystem implements MemoryFileSystem {
  async readFile(filePath: string): Promise<string> {
    return readFile(filePath, "utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, "utf-8");
  }

  async appendFile(filePath: string, content: string): Promise<void> {
    await appendFile(filePath, content, "utf-8");
  }

  async mkdir(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    return existsSync(filePath);
  }
}

/** In-memory {@link MemoryFileSystem} for hermetic tests. */
export class InMemoryMemoryFileSystem implements MemoryFileSystem {
  private readonly files = new Map<string, string>();

  async readFile(filePath: string): Promise<string> {
    const content = this.files.get(filePath);
    if (content === undefined) {
      const err = new Error(
        `ENOENT: no such file or directory, open '${filePath}'`,
      ) as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.files.set(filePath, content);
  }

  async appendFile(filePath: string, content: string): Promise<void> {
    this.files.set(filePath, (this.files.get(filePath) ?? "") + content);
  }

  async mkdir(_dirPath: string): Promise<void> {
    /* directories are implicit in the map */
  }

  async exists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }

  /** Test helper: raw stored content (undefined when absent). */
  raw(filePath: string): string | undefined {
    return this.files.get(filePath);
  }
}

/** Append-only project-local Memory store. */
export interface MemoryStore {
  /** Absolute path of the backing JSONL file. */
  readonly location: string;

  /** Append one validated record. */
  append(record: MemoryRecord): Promise<void>;

  /** Read every record in append order. */
  readAll(): Promise<MemoryRecord[]>;

  /** Return a copy of every record (explicit export surface). */
  export(): Promise<MemoryRecord[]>;

  /** Explicitly clear the store. */
  clear(): Promise<void>;
}

/** Options for {@link createMemoryStore}. */
export interface MemoryStoreOptions {
  /** Directory holding the memory file. Defaults to `<cwd>/.toneforge/memory`. */
  dir?: string;

  /** Injectable file system. Defaults to {@link NodeMemoryFileSystem}. */
  fs?: MemoryFileSystem;
}

/** Resolve the default memory directory for a working directory. */
export function resolveMemoryDir(cwd: string = process.cwd()): string {
  return join(cwd, ...MEMORY_DIR_PARTS);
}

/**
 * Append-only JSONL Memory store.
 *
 * Appends never rewrite prior content. Reads fail fast on malformed lines so
 * a corrupt store is surfaced rather than silently masked.
 */
export class JsonlMemoryStore implements MemoryStore {
  readonly location: string;
  private readonly fs: MemoryFileSystem;

  constructor(options: MemoryStoreOptions = {}) {
    const dir = options.dir ?? resolveMemoryDir();
    this.location = join(dir, MEMORY_FILE_NAME);
    this.fs = options.fs ?? new NodeMemoryFileSystem();
  }

  async append(record: MemoryRecord): Promise<void> {
    const validated = parseMemoryRecord(record);
    await this.fs.mkdir(dirname(this.location));
    await this.fs.appendFile(this.location, `${serialiseMemoryRecord(validated)}\n`);
  }

  async readAll(): Promise<MemoryRecord[]> {
    let raw: string;
    try {
      raw = await this.fs.readFile(this.location);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw error;
    }

    const records: MemoryRecord[] = [];
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (line.length === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Malformed memory record at ${this.location}:${i + 1}: ${message}`);
      }
      try {
        records.push(parseMemoryRecord(parsed));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Malformed memory record at ${this.location}:${i + 1}: ${message}`);
      }
    }
    return records;
  }

  async export(): Promise<MemoryRecord[]> {
    return this.readAll();
  }

  async clear(): Promise<void> {
    await this.fs.writeFile(this.location, "");
  }
}

/** Create a project-local Memory store. */
export function createMemoryStore(options: MemoryStoreOptions = {}): MemoryStore {
  return new JsonlMemoryStore(options);
}
