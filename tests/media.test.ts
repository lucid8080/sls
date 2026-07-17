import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseYouTubeId, rewriteImageSources, rewriteYouTubeFigures } from "@/lib/media";

describe("media rendering helpers", () => {
  it("rewrites recovered image URLs to approved re-encoded media files", () => {
    const html = '<figure><img src="/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.jpg" alt=""></figure>';
    const rewritten = rewriteImageSources(html);

    expect(rewritten).toContain("/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.webp");
    expect(rewritten).toContain('loading="lazy"');
    expect(rewritten).toContain('decoding="async"');
    expect(
      existsSync(join(process.cwd(), "public", "media", "2019", "11", "21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.webp")),
    ).toBe(true);
  });

  it("maps old WordPress uploads URLs used in TablePress cells to recovered media", () => {
    const html =
      '<img src="https://simplelifesaver.com/wp-content/uploads/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.jpg" alt="">';
    const rewritten = rewriteImageSources(html);

    expect(rewritten).toContain("/media/2019/11/21-Dishwasher-Hacks-For-The-Modern-Home-scaled-1.webp");
  });

  it("converts approved YouTube URLs to privacy-enhanced embeds", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=t3gwqcfB728")).toBe("t3gwqcfB728");
    expect(parseYouTubeId("https://youtu.be/awZ1GzGeMKM")).toBe("awZ1GzGeMKM");

    const rewritten = rewriteYouTubeFigures("<figure>\nhttps://www.youtube.com/watch?v=t3gwqcfB728\n</figure>");
    expect(rewritten).toContain("https://www.youtube-nocookie.com/embed/t3gwqcfB728");
    expect(rewritten).toContain("allowfullscreen");
  });
});
