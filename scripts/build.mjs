import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "site");
const output = process.env.BUILD_DIR ? resolve(process.env.BUILD_DIR) : join(root, "dist");

if (!existsSync(join(source, "index.html"))) {
  console.error(`Missing ${join(source, "index.html")}`);
  process.exit(1);
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });

if (!existsSync(join(output, "index.html"))) {
  console.error(`Build did not produce ${join(output, "index.html")}`);
  process.exit(1);
}

console.log(`Built ${output}`);
