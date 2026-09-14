import { supabase } from "@/integrations/supabase/client";

export type DiagramBox = { x: number; y: number; w: number; h: number };

const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 5;

/** Renders the requested 1-based pages of an uploaded paper to canvases in the browser. */
export async function renderPaperPages(
  file: File,
  pages: number[],
): Promise<Map<number, HTMLCanvasElement>> {
  const wanted = Array.from(new Set(pages.filter((p) => p >= 1)));
  const out = new Map<number, HTMLCanvasElement>();
  if (!wanted.length) return out;

  if (!file.type.includes("pdf")) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    out.set(1, canvas);
    return out;
  }

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default as string;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  for (const pageNumber of wanted) {
    if (pageNumber > doc.numPages) continue;
    const page = await doc.getPage(pageNumber);
    // High render scale so the cropped diagram stays pixel-sharp when enlarged.
    const viewport = page.getViewport({ scale: 3.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    out.set(pageNumber, canvas);
  }
  await doc.cleanup();
  return out;
}

/** Crops one diagram out of a rendered page, stores it, and returns a long-lived link. */
export async function cropAndUploadDiagram(
  page: HTMLCanvasElement,
  box: DiagramBox,
  userId: string,
): Promise<string | null> {
  // Small safety margin around the AI's estimated box: vision-based bounding-box
  // estimates for photographs in particular are sometimes a little tight or shifted
  // (e.g. clipping the top of a photo while including its caption), so a slightly
  // larger pad than a purely cosmetic border helps absorb small misses without
  // meaningfully affecting well-estimated boxes.
  const pad = 0.025;
  const x = Math.max(0, (box.x - pad) * page.width);
  const y = Math.max(0, (box.y - pad) * page.height);
  const w = Math.min(page.width - x, (box.w + pad * 2) * page.width);
  const h = Math.min(page.height - y, (box.h + pad * 2) * page.height);
  if (w < 24 || h < 24) return null;

  const crop = document.createElement("canvas");
  crop.width = Math.round(w);
  crop.height = Math.round(h);
  const context = crop.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, crop.width, crop.height);
  context.drawImage(page, x, y, w, h, 0, 0, crop.width, crop.height);

  const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, "image/png"));
  if (!blob) return null;

  const path = `${userId}/diagrams/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabase.storage.from("exam-uploads").upload(path, blob, {
    contentType: "image/png",
  });
  if (error) return null;

  const { data } = await supabase.storage.from("exam-uploads").createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}
