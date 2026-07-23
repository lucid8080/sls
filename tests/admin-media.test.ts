import { describe, expect, it } from "vitest";
import {
  combineAdminMedia,
  recoveredMediaToAdminMedia,
  type AdminMedia,
} from "@/lib/cms/admin-media";
import { getRecoveredMediaCatalog, type RecoveredMediaCatalogItem } from "@/lib/media";

function recoveredMedia(overrides: Partial<RecoveredMediaCatalogItem> = {}): RecoveredMediaCatalogItem {
  return {
    originalPath: "/media/2019/11/example-photo.jpg",
    publicPath: "/media/2019/11/example-photo.webp",
    mediaType: "jpeg",
    width: 1024,
    height: 680,
    ...overrides,
  };
}

function databaseMedia(overrides: Partial<AdminMedia> = {}): AdminMedia {
  return {
    id: "cms_1",
    filename: "uploaded.webp",
    publicPath: "/media/2026/07/uploaded.webp",
    alt: "Uploaded image",
    width: "800",
    height: "600",
    mimeType: "image/webp",
    source: "database",
    createdAt: "2026-07-01T00:00:00.000Z",
    usageCount: 0,
    inUse: false,
    ...overrides,
  };
}

describe("combined admin media", () => {
  it("exposes the full recovered catalog when the database has no overrides", () => {
    const result = combineAdminMedia([], getRecoveredMediaCatalog(), new Map());

    expect(result.length).toBeGreaterThan(7000);
    expect(result.every((item) => item.source === "recovered")).toBe(true);
  });

  it("maps recovered media into the admin media shape", () => {
    const media = recoveredMediaToAdminMedia(recoveredMedia(), 2);

    expect(media).toMatchObject({
      id: "recovered:/media/2019/11/example-photo.webp",
      filename: "example-photo.webp",
      publicPath: "/media/2019/11/example-photo.webp",
      width: "1024",
      height: "680",
      mimeType: "image/jpeg",
      source: "recovered",
      createdAt: null,
      usageCount: 2,
      inUse: true,
    });
  });

  it("combines both sources and lets database overrides win by public path", () => {
    const recovered = [
      recoveredMedia(),
      recoveredMedia({
        originalPath: "/media/2026/07/second-photo.jpg",
        publicPath: "/media/2026/07/second-photo.webp",
      }),
    ];
    const override = databaseMedia({
      publicPath: "/media/2019/11/example-photo.webp",
      filename: "example-photo.webp",
      alt: "Edited alt text",
    });

    const result = combineAdminMedia([override], recovered, new Map());

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.publicPath === "/media/2019/11/example-photo.webp")).toMatchObject({
      alt: "Edited alt text",
      source: "database",
    });
  });

  it("applies source, usage, and filename/path search after deduplication", () => {
    const recovered = [
      recoveredMedia(),
      recoveredMedia({
        originalPath: "/media/2020/05/air-fryer.jpg",
        publicPath: "/media/2020/05/air-fryer.webp",
      }),
    ];
    const override = databaseMedia({
      publicPath: "/media/2020/05/air-fryer.webp",
      filename: "air-fryer.webp",
      alt: "Air fryer hero",
      usageCount: 1,
      inUse: true,
    });
    const usageCounts = new Map([
      ["/media/2019/11/example-photo.webp", 0],
      ["/media/2020/05/air-fryer.webp", 1],
    ]);

    expect(
      combineAdminMedia([override], recovered, usageCounts, { source: "recovered", search: "example" }),
    ).toHaveLength(1);
    expect(combineAdminMedia([override], recovered, usageCounts, { source: "database" })).toEqual([override]);
    expect(combineAdminMedia([override], recovered, usageCounts, { inUse: true })).toEqual([override]);
    expect(combineAdminMedia([override], recovered, usageCounts, { search: "air-fryer" })).toEqual([override]);
    expect(combineAdminMedia([override], recovered, usageCounts, { search: "example-photo" })).toHaveLength(1);
  });
});
