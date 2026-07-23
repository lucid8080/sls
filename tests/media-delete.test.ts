import { describe, expect, it, vi } from "vitest";
import {
  assertDeletable,
  bulkDeleteAdminMedia,
  type DeleteMediaResult,
} from "@/lib/cms/media-delete";
import { databaseMediaToAdminMedia } from "@/lib/cms/admin-media";
import type { MediaUsageEntry } from "@/lib/cms/media-usage";

describe("media delete guards", () => {
  it("blocks delete when media is referenced by articles", () => {
    const media = databaseMediaToAdminMedia(
      {
        id: "cms_1",
        filename: "upload.webp",
        publicPath: "/media/2026/07/upload.webp",
        blobUrl: "https://example.blob/upload.webp",
        alt: null,
        width: "800",
        height: "600",
        mimeType: "image/webp",
        createdBy: "admin",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      1,
    );

    const usages: MediaUsageEntry[] = [
      {
        articleId: "101",
        title: "Sample guide",
        pathname: "/sample-guide/",
        source: "recovered",
        roles: ["inline"],
      },
    ];

    expect(assertDeletable(media, usages)).toEqual({
      ok: false,
      status: 409,
      usages,
    });
  });

  it("allows delete when media has no usages", () => {
    const media = databaseMediaToAdminMedia(
      {
        id: "cms_1",
        filename: "upload.webp",
        publicPath: "/media/2026/07/upload.webp",
        blobUrl: null,
        alt: null,
        width: null,
        height: null,
        mimeType: "image/webp",
        createdBy: "admin",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      0,
    );

    expect(assertDeletable(media, [])).toBeNull();
  });
});

describe("bulkDeleteAdminMedia", () => {
  it("partitions deletable, in-use, and missing ids", async () => {
    const usages: MediaUsageEntry[] = [
      {
        articleId: "101",
        title: "Sample guide",
        pathname: "/sample-guide/",
        source: "recovered",
        roles: ["inline"],
      },
    ];

    const deleteOne = vi.fn(async (id: string): Promise<DeleteMediaResult> => {
      if (id === "ok-1" || id === "ok-2") {
        return { ok: true };
      }
      if (id === "blocked-1") {
        return { ok: false, status: 409, usages };
      }
      return { ok: false, status: 404, message: "Media not found." };
    });

    const result = await bulkDeleteAdminMedia(
      ["ok-1", "blocked-1", "missing-1", "ok-2"],
      "admin@example.com",
      deleteOne,
    );

    expect(result).toEqual({
      deleted: ["ok-1", "ok-2"],
      blocked: [{ id: "blocked-1", usages }],
      notFound: ["missing-1"],
    });
    expect(deleteOne).toHaveBeenCalledTimes(4);
    expect(deleteOne).toHaveBeenNthCalledWith(1, "ok-1", "admin@example.com");
  });
});
