import { describe, expect, it, vi } from "vitest";
import {
  checkYouTubeAvailability,
  extractYouTubeEmbeds,
  removeYouTubeEmbeds,
} from "@/lib/youtube-cleanup";

describe("recovered YouTube cleanup", () => {
  it("extracts supported YouTube URLs only from plain embed figures", () => {
    const html = [
      "<p>Keep https://www.youtube.com/watch?v=AAAAAAAAAAA as a regular link.</p>",
      "<figure>\nhttps://www.youtube.com/watch?v=BBBBBBBBBBB&t=10\n</figure>",
      "<figure>https://youtu.be/CCCCCCCCCCC</figure>",
      "<figure>https://www.youtube.com/shorts/DDDDDDDDDDD</figure>",
      '<figure class="video"><iframe src="https://www.youtube.com/embed/EEEEEEEEEEE"></iframe></figure>',
    ].join("\n");

    expect(extractYouTubeEmbeds(html)).toEqual([
      {
        videoId: "BBBBBBBBBBB",
        url: "https://www.youtube.com/watch?v=BBBBBBBBBBB&t=10",
      },
      {
        videoId: "CCCCCCCCCCC",
        url: "https://youtu.be/CCCCCCCCCCC",
      },
      {
        videoId: "DDDDDDDDDDD",
        url: "https://www.youtube.com/shorts/DDDDDDDDDDD",
      },
    ]);
  });

  it("removes only figures matching selected video IDs", () => {
    const html = [
      "<p>Before</p>",
      "<figure>https://www.youtube.com/watch?v=BBBBBBBBBBB</figure>",
      "<p>Middle</p>",
      "<figure>\nhttps://youtu.be/CCCCCCCCCCC\n</figure>",
      "<p>After</p>",
    ].join("\n");

    const result = removeYouTubeEmbeds(html, new Set(["BBBBBBBBBBB"]));

    expect(result.removedCount).toBe(1);
    expect(result.html).not.toContain("BBBBBBBBBBB");
    expect(result.html).toContain("CCCCCCCCCCC");
    expect(result.html).toContain("<p>Before</p>");
  });

  it("checks videos in one YouTube Data API batch using status details", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: "AAAAAAAAAAA", status: { privacyStatus: "public", uploadStatus: "processed" } },
            { id: "CCCCCCCCCCC", status: { privacyStatus: "unlisted", uploadStatus: "processed" } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await checkYouTubeAvailability(
      ["AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC"],
      { apiKey: "test-key", fetchImpl: fetchMock },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("part=status");
    expect(result.method).toBe("youtube-data-api");
    expect(result.videos).toEqual([
      { videoId: "AAAAAAAAAAA", status: "available" },
      { videoId: "BBBBBBBBBBB", status: "unavailable" },
      { videoId: "CCCCCCCCCCC", status: "available" },
    ]);
  });

  it("does not classify API failures as unavailable", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("quota exceeded", { status: 403 }),
    );

    const result = await checkYouTubeAvailability(["AAAAAAAAAAA"], {
      apiKey: "test-key",
      fetchImpl: fetchMock,
    });

    expect(result.videos[0]).toMatchObject({
      videoId: "AAAAAAAAAAA",
      status: "error",
    });
  });

  it("treats oEmbed 401 as restricted, not unavailable", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    const result = await checkYouTubeAvailability(
      ["AAAAAAAAAAA", "BBBBBBBBBBB", "CCCCCCCCCCC"],
      { fetchImpl: fetchMock },
    );

    expect(result.method).toBe("youtube-oembed");
    expect(result.videos).toEqual([
      { videoId: "AAAAAAAAAAA", status: "unavailable" },
      {
        videoId: "BBBBBBBBBBB",
        status: "restricted",
        error: "YouTube oEmbed returned HTTP 401 (video exists but is restricted).",
      },
      {
        videoId: "CCCCCCCCCCC",
        status: "error",
        error: "YouTube oEmbed returned HTTP 429.",
      },
    ]);
  });
});
