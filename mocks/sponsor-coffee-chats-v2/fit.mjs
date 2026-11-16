// The sponsor shell scrolls inside an inner element, so Playwright's
// fullPage capture stops at the first screen. Grow the viewport to the
// tallest scroll height instead.
export async function fitToContent(page, width) {
  const height = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll("*")].map((el) => el.scrollHeight),
    ),
  );
  await page.setViewportSize({ width, height: Math.min(height, 6000) });
  await page.waitForTimeout(300);
}
