/**
 * Render Lottie frames to PNG in headless Chromium with lottie-web (the player the web app uses).
 *
 *   node render.mjs <out-dir> <size> <frames|"rest"|"strip:N"> file1.json file2.json …
 *
 * "rest"     → the rest frame (start of the "idle" marker, or the last frame) → <name>.png
 * "strip:N"  → N frames evenly spread over the whole timeline → <name>@<frame>.png
 * "a,b,c"    → explicit frames → <name>@<frame>.png
 *
 * Env: PW_CHROMIUM (default /opt/pw-browsers/chromium), LOTTIE_JS (path to lottie.min.js),
 *      BG (css background, default transparent).
 */
import { readFileSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const benchRoot = process.env.BENCH ?? "/home/claude/bench";
const { chromium } = require(resolve(benchRoot, "node_modules/playwright-core"));
const lottieJs = process.env.LOTTIE_JS ?? resolve(benchRoot, "node_modules/lottie-web/build/player/lottie.min.js");

const [outDir, sizeArg, framesArg, ...files] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const size = Number(sizeArg);

const exe = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:${process.env.BG ?? "transparent"}"><div id="c"></div></body></html>`);
await page.addScriptTag({ content: readFileSync(lottieJs, "utf8") });

for (const f of files) {
  const data = JSON.parse(readFileSync(f, "utf8"));
  const name = basename(f, ".json");
  const w = data.w >= data.h ? size : Math.round((size * data.w) / data.h);
  const h = data.w >= data.h ? Math.round((size * data.h) / data.w) : size;
  const idle = (data.markers ?? []).find((m) => m.cm === "idle");
  const rest = idle ? idle.tm : data.op - 1;
  let frames;
  if (framesArg === "rest") frames = [rest];
  else if (framesArg.startsWith("strip:")) {
    const n = Number(framesArg.slice(6));
    frames = Array.from({ length: n }, (_, k) => Math.round((k * (data.op - 1)) / (n - 1)));
  } else frames = framesArg.split(",").map(Number);

  await page.evaluate(
    ({ data, w, h }) => {
      window.__a?.destroy();
      const c = document.getElementById("c");
      c.style.width = w + "px";
      c.style.height = h + "px";
      window.__a = window.lottie.loadAnimation({ container: c, renderer: "svg", loop: false, autoplay: false, animationData: data });
    },
    { data, w, h },
  );
  for (const fr of frames) {
    await page.evaluate((fr) => window.__a.goToAndStop(fr, true), fr);
    const el = await page.$("#c");
    const out = framesArg === "rest" ? `${outDir}/${name}.png` : `${outDir}/${name}@${String(fr).padStart(3, "0")}.png`;
    await el.screenshot({ path: out, omitBackground: !process.env.BG });
  }
}
await browser.close();
