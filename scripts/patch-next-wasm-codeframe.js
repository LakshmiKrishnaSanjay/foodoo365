/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const files = [
  "node_modules/next/dist/build/swc/index.js",
  "node_modules/next/dist/esm/build/swc/index.js",
];

const original = `        codeFrameColumns (source, location, options) {
            return rawBindings.codeFrameColumns(Buffer.from(source), location, options);
        },`;

const patched = `        codeFrameColumns (source, location, options) {
            // The WASM binding rejects the boolean color and undefined fields that
            // Next's own callers pass. The native binding accepts both.
            const normalized = options ? {
                ...options
            } : {};
            if (typeof normalized.color === 'boolean') {
                normalized.color = normalized.color ? 'Error' : 'None';
            }
            return rawBindings.codeFrameColumns(Buffer.from(source), removeUndefined(location), removeUndefined(normalized));
        },`;

for (const relative of files) {
  const file = path.join(__dirname, "..", relative);
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("normalized.color = normalized.color ? 'Error' : 'None'")) continue;
  if (!source.includes(original)) {
    console.warn(`Could not patch ${relative}`);
    continue;
  }
  fs.writeFileSync(file, source.replace(original, patched));
  console.log(`Patched ${relative}`);
}
