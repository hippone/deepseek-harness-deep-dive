import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public", "site");
const siteUrl = "https://hippone.github.io/deepseek-harness-internals/";

await mkdir(outputDir, {recursive: true});

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({
  viewport: {width: 1440, height: 1000},
  deviceScaleFactor: 1.5,
  colorScheme: "dark",
});

await page.addInitScript(() => {
  localStorage.setItem("dsh-docs-theme", "dark");
});
await page.goto(siteUrl, {waitUntil: "networkidle"});
await page.evaluate(async () => {
  await document.fonts.ready;
});

const hero = page.locator(".home-hero");
await hero.waitFor({state: "visible"});
const box = await hero.boundingBox();
if (!box) {
  throw new Error("Homepage hero did not produce a visible bounding box");
}

await page.screenshot({
  path: path.join(outputDir, "homepage-hero.png"),
  clip: {
    x: Math.max(0, box.x - 28),
    y: Math.max(0, box.y - 28),
    width: Math.min(1440, box.width + 56),
    height: box.height + 56,
  },
});
await page.screenshot({
  path: path.join(outputDir, "homepage-full.png"),
  fullPage: true,
});

const logoPath = await page.locator(".hero-whale").getAttribute("src");
if (logoPath) {
  const response = await page.request.get(new URL(logoPath, siteUrl).toString());
  if (response.ok()) {
    await writeFile(path.join(outputDir, "deepseek-logo.svg"), await response.body());
  }
}

const facts = await page.evaluate(() => {
  const styles = getComputedStyle(document.documentElement);
  const chapterLinks = [...document.querySelectorAll(".chapter-tree a")].map((link) =>
    link.textContent?.replace(/\s+/g, " ").trim(),
  );
  const rail = [...document.querySelectorAll(".architecture-rail > div")].map((node) =>
    node.textContent?.replace(/\s+/g, " ").trim(),
  );
  return {
    title: document.querySelector(".home-hero h1")?.textContent?.replace(/\s+/g, " ").trim(),
    subtitle: document.querySelector(".hero-lede")?.textContent?.replace(/\s+/g, " ").trim(),
    baseline: document.querySelector(".baseline-strip code")?.textContent?.trim(),
    rail,
    chapterLinks,
    colors: {
      background: styles.getPropertyValue("--ds-bg-page").trim(),
      text: styles.getPropertyValue("--ds-text-primary").trim(),
      description: styles.getPropertyValue("--ds-text-description").trim(),
      brand: styles.getPropertyValue("--ds-brand").trim(),
      border: styles.getPropertyValue("--ds-border-strong").trim(),
    },
  };
});

await writeFile(path.join(outputDir, "site-facts.json"), `${JSON.stringify(facts, null, 2)}\n`);
await browser.close();

console.log(`Captured ${siteUrl}`);
console.log(JSON.stringify(facts, null, 2));
