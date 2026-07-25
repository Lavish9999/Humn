import * as playwright from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright.default ?? playwright;
const widths = [360, 375, 390, 430];
const targetUrl = process.env.DISCOVER_AUDIT_URL ?? 'http://127.0.0.1:3000/discover';
const outputDir = path.resolve(process.env.DISCOVER_AUDIT_OUTPUT ?? 'artifacts/discover-mobile');
const fixturePath = process.env.DISCOVER_AUDIT_FIXTURE_HTML;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const fixtureHtml = fixturePath ? await readFile(path.resolve(fixturePath), 'utf8') : null;

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox'],
});

const report = [];

for (const width of widths) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
  });

  if (fixtureHtml) {
    await page.setContent(fixtureHtml, { waitUntil: 'load' });
  } else {
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
  }

  const refineButton = page.getByRole('button', { name: /^Refine feed/ });
  if (await refineButton.count()) {
    const expanded = await refineButton.first().getAttribute('aria-expanded');
    if (expanded !== 'true') await refineButton.first().click();
  }

  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const overflowingElements = [...document.querySelectorAll('body *')]
      .map((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return null;

        const rect = element.getBoundingClientRect();
        const overflowLeft = Math.max(0, -rect.left);
        const overflowRight = Math.max(0, rect.right - viewportWidth);
        if (overflowLeft <= 0.5 && overflowRight <= 0.5) return null;

        const classes = typeof element.className === 'string'
          ? element.className.trim().split(/\s+/).filter(Boolean).join('.')
          : '';

        return {
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes ? `.${classes}` : ''}`,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          overflowLeft: Math.round(overflowLeft * 10) / 10,
          overflowRight: Math.round(overflowRight * 10) / 10,
        };
      })
      .filter(Boolean)
      .sort((left, right) => (
        right.overflowLeft + right.overflowRight
      ) - (
        left.overflowLeft + left.overflowRight
      ));

    return {
      viewportWidth,
      documentWidth,
      horizontalOverflow: Math.max(0, documentWidth - viewportWidth),
      overflowingElements: overflowingElements.slice(0, 12),
    };
  });

  const screenshotPath = path.join(outputDir, `discover-${width}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  report.push({ width, screenshotPath, ...metrics });
  await page.close();
}

await browser.close();
await writeFile(
  path.join(outputDir, 'audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

if (report.some((result) => result.horizontalOverflow > 0)) {
  process.exitCode = 1;
}
