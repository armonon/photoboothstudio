import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { findPlate } from "@/lib/composite/plates";
import { renderSceneToPngBuffer } from "@/lib/composite/server";
import { createScene, getPlates, getProduct, persistExportAssets } from "@/lib/data";
import { assertWithin } from "@/lib/safe-path";
import { designWithCustomPrint } from "@/lib/design";
import { ValidationError, parseExportRequest } from "@/lib/validation";
import type { ExportAsset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return await handleExport(req);
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status },
    );
  }
}

async function handleExport(req: Request) {
  const { scene, customPrint } = parseExportRequest(await req.json());
  const product = await getProduct(scene.productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const plates = await getPlates();
  // Unique per export: timestamp + random suffix so two exports in the same
  // second can't overwrite each other.
  const exportId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
  const productSlug = slugify(product.name || product.id);
  const publicDir = path.join(process.cwd(), "public");
  // assertWithin rejects any product.id that would escape ./public/exports.
  const exportDir = assertWithin(path.join(publicDir, "exports"), path.join(product.id, exportId));
  const publicBase = `/exports/${product.id}/${exportId}`;
  await mkdir(exportDir, { recursive: true });

  const assets: ExportAsset[] = [];
  const viewFiles: string[] = [];

  for (const view of ["front", "back", "side"] as const) {
    const plate = findPlate(plates, product.type, view, scene.fitStyle, scene.modelType);
    if (!plate) continue;

    const viewScene = { ...scene, view };
    const design = designWithCustomPrint(product, view, customPrint);
    const filename = `${productSlug}-${view}-2048.png`;
    const filePath = path.join(exportDir, filename);
    const buffer = await renderSceneToPngBuffer(viewScene, design, plate);
    await writeFile(filePath, buffer);
    viewFiles.push(filePath);
    assets.push({
      url: `${publicBase}/${filename}`,
      format: "png",
      width: 2048,
      height: 2048,
      channel: "store",
      filename,
      altText: `${product.name} ${view} view product image`,
      view,
      role: view === scene.view ? "hero" : "view",
    });
  }

  const transparentPlate = findPlate(plates, product.type, scene.view, scene.fitStyle, scene.modelType);
  if (transparentPlate) {
    const filename = `${productSlug}-${scene.view}-transparent.png`;
    const filePath = path.join(exportDir, filename);
    const buffer = await renderSceneToPngBuffer(
      { ...scene, background: "transparent", customBackgroundUrl: undefined },
      designWithCustomPrint(product, scene.view, customPrint),
      transparentPlate,
    );
    await writeFile(filePath, buffer);
    assets.push({
      url: `${publicBase}/${filename}`,
      format: "png",
      width: 2048,
      height: 2048,
      channel: "store",
      filename,
      altText: `${product.name} transparent ${scene.view} view product image`,
      view: scene.view,
      role: "transparent",
    });
  }

  if (viewFiles.length > 0) {
    // Video is best-effort: if ffmpeg is missing or fails, still return the images
    // rather than failing the whole export.
    try {
      const squareVideo = path.join(exportDir, `${productSlug}-product-pan.mp4`);
      const verticalVideo = path.join(exportDir, `${productSlug}-product-pan-vertical.mp4`);
      await createSquareVideo(viewFiles, squareVideo);
      await createVerticalVideo(squareVideo, verticalVideo);
      assets.push(
        {
          url: `${publicBase}/${path.basename(squareVideo)}`,
          format: "mp4",
          width: 1080,
          height: 1080,
          channel: "store",
          filename: path.basename(squareVideo),
          altText: `${product.name} short product video`,
          role: "video",
        },
        {
          url: `${publicBase}/${path.basename(verticalVideo)}`,
          format: "mp4",
          width: 1080,
          height: 1920,
          channel: "tiktok",
          filename: path.basename(verticalVideo),
          altText: `${product.name} vertical product video for TikTok and Reels`,
          role: "verticalVideo",
        },
      );
    } catch (err) {
      console.error("Video export skipped:", err instanceof Error ? err.message : err);
    }
  }

  const savedScene = await createScene(scene);
  const savedAssets = await persistExportAssets(product.id, savedScene?.id, assets);

  return NextResponse.json({ assets: savedAssets });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

async function createSquareVideo(inputs: string[], output: string) {
  const videoSize = 1080;
  const fps = 24;
  const seconds = 1.6;
  const fade = 0.45;
  const frames = Math.round(fps * seconds);
  const args = ["-y"];

  for (const input of inputs) {
    args.push("-loop", "1", "-t", String(seconds), "-i", input);
  }

  const filters = inputs.map(
    (_input, index) =>
      `[${index}:v]scale=${videoSize}:${videoSize}:force_original_aspect_ratio=increase,crop=${videoSize}:${videoSize},` +
      `zoompan=z='min(zoom+0.0014,1.07)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${videoSize}x${videoSize}:fps=${fps},setsar=1[v${index}]`,
  );

  if (inputs.length === 1) {
    filters.push("[v0]format=yuv420p[v]");
  } else {
    let previous = "v0";
    for (let index = 1; index < inputs.length; index += 1) {
      const outputLabel = index === inputs.length - 1 ? "v" : `x${index}`;
      const offset = ((seconds - fade) * index).toFixed(2);
      filters.push(
        `[${previous}][v${index}]xfade=transition=fade:duration=${fade}:offset=${offset}${outputLabel === "v" ? ",format=yuv420p" : ""}[${outputLabel}]`,
      );
      previous = outputLabel;
    }
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[v]",
    "-an",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  );

  await runFfmpeg(args);
}

async function createVerticalVideo(input: string, output: string) {
  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-vf",
    "scale=-2:1920,crop=1080:1920,setsar=1",
    "-an",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ]);
}
