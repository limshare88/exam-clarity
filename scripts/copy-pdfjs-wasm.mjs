// pdf.js needs its WASM decoders (openjpeg.wasm for JPEG2000/JPX images, jbig2.wasm,
// qcms_bg.wasm for ICC colour profiles) available at a URL it constructs itself by string
// concatenation (`${wasmUrl}openjpeg.wasm`, etc.) — see src/lib/diagram-crop.ts. There is
// no bundler-friendly way to hand it these individually the way the main worker script is
// handed a hashed URL, because pdf.js expects the exact unhashed filenames at that prefix.
// The standard fix is to serve them verbatim from a known path, so this script copies
// pdfjs-dist's wasm/ folder into public/pdfjs-wasm/ (served as-is by Vite, both in dev and
// in the build output) every time dependencies are installed — see the "postinstall",
// "predev", and "prebuild" scripts in package.json. Without this, JPX-encoded images
// (some exam boards embed photographs this way) silently fail to decode: pdf.js renders
// the rest of the page normally but leaves that image's area blank, with no visible error.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "node_modules", "pdfjs-dist", "wasm");
const dest = join(here, "..", "public", "pdfjs-wasm");

if (!existsSync(src)) {
  console.warn(`[copy-pdfjs-wasm] ${src} not found — skipping (pdfjs-dist not installed yet?)`);
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-pdfjs-wasm] copied ${src} -> ${dest}`);
