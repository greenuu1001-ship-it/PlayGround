import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const url = process.env.CAPTURE_URL;
const output = process.env.CAPTURE_DIR;
const projectRoot = resolve(process.env.PROJECT_DIR || join(import.meta.dirname, ".."));
const readySelector = process.env.CAPTURE_READY_SELECTOR || '[data-app-ready="true"]';
const timeout = Number(process.env.CAPTURE_TIMEOUT_MS || 45000);

function tagged(code, message) {
  const error = new Error(message);
  error.exitCode = code;
  return error;
}

function transient(error) {
  if (!error || !error.exitCode) {
    error.exitCode = 75;
  }
  throw error;
}

async function run() {
  if (!url) {
    throw tagged(1, "CAPTURE_URL is required");
  }
  if (!output) {
    throw tagged(1, "CAPTURE_DIR is required");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw tagged(1, `CAPTURE_URL is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw tagged(1, `CAPTURE_URL must use http or https: ${url}`);
  }

  const captureDir = resolve(output);
  if (captureDir === projectRoot || captureDir.startsWith(projectRoot + "/")) {
    throw tagged(1, `CAPTURE_DIR must be outside the project source: ${captureDir}`);
  }
  mkdirSync(captureDir, { recursive: true });

  const runtime = process.env.PLAYWRIGHT_RUNTIME || join(homedir(), ".local/share/omgithub-playwright");
  if (!existsSync(join(runtime, "node_modules", "playwright")) && !existsSync(join(runtime, "package.json"))) {
    throw tagged(75, `Playwright runtime is missing: ${runtime}`);
  }

  const require = createRequire(join(runtime, "package.json"));
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (error) {
    throw tagged(75, `Unable to load Playwright: ${error.message}`);
  }

  const configFile = join(runtime, process.platform === "darwin" ? "metal.json" : "linux.json");
  let launchOptions = {};
  try {
    const config = JSON.parse(readFileSync(configFile, "utf8"));
    launchOptions = config.browser?.launchOptions || {};
  } catch (error) {
    throw tagged(75, `Unable to read browser configuration ${configFile}: ${error.message}`);
  }

  if (process.platform === "linux" && !process.env.DISPLAY) {
    try {
      process.env.DISPLAY = ":" + readFileSync(join(runtime, "display"), "utf8").trim();
    } catch (error) {
      throw tagged(75, `Unable to determine X display: ${error.message}`);
    }
  }

  const views = [
    { name: "desktop", width: 1440, height: 900, scale: 1 },
    { name: "mobile", width: 390, height: 844, scale: 2, mobile: true },
  ];

  let browser;
  let page;

  try {
    try {
      browser = await chromium.launch({ ...launchOptions, timeout: 45000 });
    } catch (error) {
      transient(error);
    }

    for (const view of views) {
      try {
        page = await browser.newPage({
          viewport: { width: view.width, height: view.height },
          deviceScaleFactor: view.scale,
          isMobile: Boolean(view.mobile),
          hasTouch: Boolean(view.mobile),
        });
      } catch (error) {
        transient(error);
      }

      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);

      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      let response;
      try {
        response = await page.goto(url, { waitUntil: "load", timeout });
      } catch (error) {
        transient(error);
      }

      if (!response) {
        throw tagged(75, `No HTTP response loading ${url}`);
      }
      if (!response.ok()) {
        const status = response.status();
        const code = status === 408 || status === 429 || status >= 500 ? 75 : 1;
        throw tagged(code, `HTTP ${status} loading ${url}`);
      }

      try {
        await page.waitForSelector(readySelector, { state: "visible", timeout });
      } catch (error) {
        const messages = pageErrors.length ? ` Page errors: ${pageErrors.join("; ")}` : "";
        throw tagged(1, `Rendered content was not ready (${readySelector}).${messages}`);
      }

      try {
        await page.evaluate(() => document.fonts?.ready);
      } catch (error) {
        throw tagged(1, `Unable to verify rendered fonts: ${error.message}`);
      }

      const rendered = await page.evaluate(() => {
        const text = document.body?.innerText?.trim() || "";
        const ready = document.body?.dataset?.appReady === "true";
        return { ready, textLength: text.length, title: document.title };
      });

      if (!rendered.ready || rendered.textLength < 20) {
        throw tagged(1, `Rendered page is blank or incomplete (text length ${rendered.textLength})`);
      }
      if (pageErrors.length) {
        throw tagged(1, `Page reported errors: ${pageErrors.join("; ")}`);
      }

      await page.waitForTimeout(900);

      const screenshot = join(captureDir, `final-${view.name}.png`);
      try {
        await page.screenshot({ path: screenshot, timeout });
      } catch (error) {
        if (error.name === "TimeoutError" || !browser.isConnected()) {
          transient(error);
        }
        throw tagged(1, `Unable to capture ${view.name} view: ${error.message}`);
      }

      console.log(`Captured ${view.name} ${view.width}x${view.height}: ${screenshot}`);
      await page.close();
      page = undefined;
    }
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error(error?.stack || error);
        process.exitCode ||= 75;
      }
    }
  }
}

run().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = error?.exitCode || process.exitCode || 1;
});
