import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  canonicalStringify,
  createManifest,
  hashBytes,
  parseManifest,
  serializeManifest,
  type ManifestAsset,
} from "../manifest.js";

/** Build a manifest asset fixture with sensible defaults. */
function asset(
  assetId: string,
  overrides: Partial<ManifestAsset> = {},
): ManifestAsset {
  return {
    assetId,
    category: "UI",
    recipe: "ui-notification-chime",
    duration: 0.5,
    decision: "baked",
    file: `UI/${assetId}.wav`,
    hash: hashBytes(new Uint8Array([assetId.length])),
    bytes: 100,
    ...overrides,
  };
}

describe("hashBytes", () => {
  it("returns the known SHA-256 digest of an empty input", () => {
    expect(hashBytes(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hashBytes(new Uint8Array(0))).toBe(
      createHash("sha256").update("").digest("hex"),
    );
  });

  it("hashes bytes, not string coercion", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    expect(hashBytes(bytes)).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  });
});

describe("canonicalStringify", () => {
  it("sorts object keys recursively", () => {
    const value = { b: 1, a: { d: 2, c: 3 } };
    expect(canonicalStringify(value)).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalStringify({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}');
  });
});

describe("createManifest", () => {
  const assets = [
    asset("lib-b", { category: "Impact", decision: "baked" }),
    asset("lib-a", { category: "UI", decision: "procedural", file: null, hash: null, bytes: null }),
    asset("lib-c", { category: "UI", decision: "hybrid" }),
  ];

  it("sorts assets by assetId", () => {
    const manifest = createManifest({ target: "web", assets });
    expect(manifest.assets.map((a) => a.assetId)).toEqual([
      "lib-a",
      "lib-b",
      "lib-c",
    ]);
  });

  it("counts decisions by strategy", () => {
    const manifest = createManifest({ target: "web", assets });
    expect(manifest.proceduralAssets).toBe(1);
    expect(manifest.hybridAssets).toBe(1);
    expect(manifest.bakedAssets).toBe(1);
  });

  it("derives buildId from the manifest hash", () => {
    const manifest = createManifest({ target: "web", assets });
    expect(manifest.buildId).toBe(`tfc_${manifest.hash.slice(0, 16)}`);
    expect(manifest.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic regardless of input order", () => {
    const first = createManifest({ target: "web", assets });
    const second = createManifest({
      target: "web",
      assets: [assets[2]!, assets[0]!, assets[1]!],
    });
    expect(second).toEqual(first);
    expect(serializeManifest(second)).toBe(serializeManifest(first));
  });

  it("changes the hash when an asset's bytes change", () => {
    const base = createManifest({ target: "web", assets });
    const changed = createManifest({
      target: "web",
      assets: [assets[0]!, assets[1]!, asset("lib-c", { decision: "hybrid", bytes: 101 })],
    });
    expect(changed.hash).not.toBe(base.hash);
  });

  it("changes the hash when the target changes", () => {
    const web = createManifest({ target: "web", assets });
    const mobile = createManifest({ target: "mobile", assets });
    expect(mobile.hash).not.toBe(web.hash);
  });

  it("does not include timestamps or host data", () => {
    const manifest = createManifest({ target: "web", assets });
    expect(Object.keys(manifest).sort()).toEqual(
      [
        "assets",
        "bakedAssets",
        "buildId",
        "hash",
        "hybridAssets",
        "proceduralAssets",
        "target",
      ].sort(),
    );
  });

  it("is JSON-serialisable and round-trips through parseManifest", () => {
    const manifest = createManifest({ target: "web", assets });
    const json = serializeManifest(manifest);
    expect(JSON.parse(json)).toEqual(manifest);
    expect(parseManifest(json)).toEqual(manifest);
  });

  it("serialises identically for equal manifests", () => {
    const a = createManifest({ target: "web", assets });
    const b = createManifest({ target: "web", assets });
    expect(serializeManifest(a)).toBe(serializeManifest(b));
  });
});
