import { expect, test } from "@playwright/test";

test("homepage renders and exposes search", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Make your home easier");
  await expect(page.getByRole("link", { name: /search guides/i })).toBeVisible();
});

test("search page returns public guides", async ({ page }) => {
  await page.goto("/search/?q=robot%20vacuum");

  await expect(page.getByRole("heading", { name: /results for/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /robot/i }).first()).toBeVisible();
});

test("article renders recovered images and safe YouTube embeds", async ({ page }) => {
  await page.goto("/21-dishwasher-hacks-for-the-modern-home/");

  const firstImage = page.locator(".article-body img").first();
  await expect(firstImage).toHaveAttribute("src", /\/media\/.+\.webp$/);
  await firstImage.scrollIntoViewIfNeeded();
  await expect(firstImage).toHaveJSProperty("complete", true);
  await expect(firstImage).toBeVisible();
  await expect(page.locator('iframe[src*="youtube-nocookie.com/embed/t3gwqcfB728"]')).toBeVisible();
});

test("article heroes and cards render recovered featured images", async ({ page }) => {
  await page.goto("/7-ai-automations-that-save-me-10-hours-every-week/");

  const heroImage = page.locator(".article-hero-image img");
  await expect(heroImage).toHaveAttribute("src", /\/media\/.+\.(webp|gif)$/);
  await expect(heroImage).toHaveJSProperty("complete", true);
  await expect(heroImage).toBeVisible();

  await page.goto("/");
  const cardImage = page.locator(".article-card-image img").first();
  await expect(cardImage).toHaveAttribute("src", /\/media\/.+\.(webp|gif)$/);
  await expect(cardImage).toBeVisible();
});
