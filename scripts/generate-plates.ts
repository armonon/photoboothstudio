import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FitStyle, ModelType, View } from "../src/lib/types";

const outDir = path.join(process.cwd(), "public", "plates");
const size = 2048;
const fits: FitStyle[] = ["regular", "oversized", "cropped", "relaxed", "boxy", "streetwear"];
const models: ModelType[] = ["neutralMannequin", "ghostMannequin", "croppedProductOnly", "facelessMannequin"];
const views: View[] = ["front", "back", "side"];

const fitScale: Record<FitStyle, number> = {
  regular: 1,
  oversized: 1.13,
  cropped: 0.9,
  relaxed: 1.06,
  boxy: 1.1,
  streetwear: 1.18,
};

async function savePng(filename: string, canvas: any) {
  await writeFile(path.join(outDir, filename), canvas.toBuffer("image/png"));
}

function regionFor(view: View, fit: FitStyle) {
  const scale = fitScale[fit];
  const width = view === "side" ? 360 * scale : 680 * scale;
  const height = view === "side" ? 560 * scale : 760 * (fit === "cropped" ? 0.82 : 1);
  const centerX = view === "side" ? 1088 : 1024;
  const y = view === "side" ? 660 : fit === "cropped" ? 600 : 610;
  return { x: centerX - width / 2, y, width, height };
}

function withCanvas(draw: (ctx: any) => void): any {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  draw(ctx);
  return canvas;
}

function garmentPath(ctx: any, view: View, fit: FitStyle) {
  const scale = fitScale[fit];
  const cropped = fit === "cropped";
  const cx = view === "side" ? 1058 : 1024;
  const shoulderY = 500;
  const hemY = cropped ? 1320 : 1485;

  ctx.beginPath();
  if (view === "side") {
    const shoulderW = 360 * scale;
    const bodyW = 300 * scale;
    ctx.moveTo(cx - shoulderW / 2, shoulderY + 40);
    ctx.quadraticCurveTo(cx - shoulderW / 2 - 110 * scale, 690, cx - bodyW / 2 - 30, 900);
    ctx.quadraticCurveTo(cx - bodyW / 2 - 20, 1140, cx - bodyW / 2 + 20, hemY);
    ctx.lineTo(cx + bodyW / 2 + 50, hemY - 18);
    ctx.quadraticCurveTo(cx + bodyW / 2 + 12, 1080, cx + bodyW / 2 + 72, 790);
    ctx.quadraticCurveTo(cx + shoulderW / 2 + 12, 610, cx + shoulderW / 2, shoulderY + 70);
    ctx.quadraticCurveTo(cx + 50, shoulderY + 16, cx - shoulderW / 2, shoulderY + 40);
    ctx.closePath();
    return;
  }

  const shoulderW = 820 * scale;
  const sleeveW = 240 * scale;
  const bodyTopW = 610 * scale;
  const bodyBottomW = (fit === "boxy" || fit === "streetwear" ? 710 : 650) * scale;
  ctx.moveTo(cx - bodyTopW / 2, shoulderY + 70);
  ctx.lineTo(cx - shoulderW / 2, shoulderY + 28);
  ctx.quadraticCurveTo(cx - shoulderW / 2 - sleeveW, shoulderY + 130, cx - shoulderW / 2 - sleeveW * 0.85, shoulderY + 340);
  ctx.quadraticCurveTo(cx - shoulderW / 2 - sleeveW * 0.45, shoulderY + 432, cx - shoulderW / 2 + 12, shoulderY + 335);
  ctx.quadraticCurveTo(cx - bodyBottomW / 2 - 32, 990, cx - bodyBottomW / 2, hemY);
  ctx.quadraticCurveTo(cx, hemY + 58, cx + bodyBottomW / 2, hemY);
  ctx.quadraticCurveTo(cx + bodyBottomW / 2 + 32, 990, cx + shoulderW / 2 - 12, shoulderY + 335);
  ctx.quadraticCurveTo(cx + shoulderW / 2 + sleeveW * 0.45, shoulderY + 432, cx + shoulderW / 2 + sleeveW * 0.85, shoulderY + 340);
  ctx.quadraticCurveTo(cx + shoulderW / 2 + sleeveW, shoulderY + 130, cx + shoulderW / 2, shoulderY + 28);
  ctx.lineTo(cx + bodyTopW / 2, shoulderY + 70);
  ctx.quadraticCurveTo(cx + 140, shoulderY + 160, cx, shoulderY + 150);
  ctx.quadraticCurveTo(cx - 140, shoulderY + 160, cx - bodyTopW / 2, shoulderY + 70);
  ctx.closePath();
}

function drawMannequin(ctx: any, view: View, model: ModelType) {
  ctx.save();
  ctx.fillStyle = "rgba(190, 190, 184, 0.95)";
  ctx.strokeStyle = "rgba(115, 115, 110, 0.2)";
  ctx.lineWidth = 8;

  if (model !== "croppedProductOnly") {
    ctx.beginPath();
    ctx.ellipse(view === "side" ? 930 : 1024, 335, view === "side" ? 88 : 118, 144, view === "side" ? -0.18 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(178, 178, 170, 0.88)";
  ctx.beginPath();
  if (view === "side") {
    ctx.roundRect(835, 470, 390, 1010, 170);
  } else {
    ctx.roundRect(720, 470, 608, 1040, 220);
  }
  ctx.fill();

  if (model === "neutralMannequin") {
    ctx.fillStyle = "rgba(166, 166, 158, 0.7)";
    if (view !== "side") {
      ctx.beginPath();
      ctx.roundRect(498, 630, 170, 870, 88);
      ctx.roundRect(1380, 630, 170, 870, 88);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.roundRect(1225, 630, 145, 810, 74);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Ghost mannequin: no body at all, just the dark recessed interior seen through the
// neck opening — the "invisible mannequin" / hollow-man look. Drawn before the garment
// so the garment fill covers all but the part showing through the collar.
function drawGhostInterior(ctx: any, view: View) {
  ctx.save();
  if (view === "side") {
    ctx.fillStyle = "rgba(48, 48, 46, 0.92)";
    ctx.beginPath();
    ctx.ellipse(1006, 560, 74, 104, -0.22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const grad = ctx.createRadialGradient(1024, 648, 20, 1024, 636, 150);
    grad.addColorStop(0, "rgba(26, 26, 25, 0.96)");
    grad.addColorStop(1, "rgba(70, 70, 66, 0.9)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(1024, 636, 146, 70, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// The collar rim on top of the garment: a lit back edge and a shadowed front edge,
// which together make the neckline read as a hollow opening with depth.
function drawGhostCollar(ctx: any) {
  ctx.save();
  ctx.strokeStyle = "rgba(226, 224, 216, 0.85)";
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.ellipse(1024, 622, 150, 52, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.ellipse(1024, 640, 150, 52, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawPlate(ctx: any, view: View, fit: FitStyle, model: ModelType) {
  if (model === "ghostMannequin") drawGhostInterior(ctx, view);
  else drawMannequin(ctx, view, model);

  ctx.save();
  garmentPath(ctx, view, fit);
  ctx.clip();

  const grad = ctx.createLinearGradient(600, 500, 1440, 1500);
  grad.addColorStop(0, "#f2f1ec");
  grad.addColorStop(0.48, "#dad9d2");
  grad.addColorStop(1, "#f5f2ea");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const foldCount = view === "side" ? 7 : 11;
  for (let i = 0; i < foldCount; i += 1) {
    const x = view === "side" ? 930 + i * 42 : 660 + i * 76;
    ctx.beginPath();
    ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.11)";
    ctx.lineWidth = i % 2 === 0 ? 11 : 7;
    ctx.moveTo(x, 585);
    ctx.bezierCurveTo(x + 34, 800, x - 34, 1040, x + 26, 1465);
    ctx.stroke();
  }

  ctx.restore();

  ctx.save();
  garmentPath(ctx, view, fit);
  ctx.strokeStyle = "rgba(67, 67, 62, 0.22)";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();

  if (view !== "side") {
    ctx.save();
    ctx.strokeStyle = "rgba(70,70,65,0.25)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(1024, 610, 155, 66, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.restore();
  }

  if (model === "ghostMannequin" && view !== "side") drawGhostCollar(ctx);
}

function drawMask(ctx: any, view: View, fit: FitStyle) {
  garmentPath(ctx, view, fit);
  ctx.fillStyle = "white";
  ctx.fill();
}

function drawShadow(ctx: any, view: View, fit: FitStyle) {
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, size, size);
  const region = regionFor(view, fit);
  const grad = ctx.createLinearGradient(region.x, region.y, region.x + region.width, region.y + region.height);
  grad.addColorStop(0, "rgba(188,188,188,0.18)");
  grad.addColorStop(0.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(130,130,130,0.24)");
  ctx.fillStyle = grad;
  ctx.fillRect(region.x - 20, region.y - 20, region.width + 40, region.height + 40);

  for (let i = 0; i < 9; i += 1) {
    const t = i / 8;
    ctx.beginPath();
    ctx.strokeStyle = i % 2 ? "rgba(108,108,108,0.22)" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = i % 2 ? 18 : 12;
    const x = region.x + region.width * t;
    ctx.moveTo(x, region.y);
    ctx.bezierCurveTo(x - 34, region.y + region.height * 0.32, x + 38, region.y + region.height * 0.68, x - 18, region.y + region.height);
    ctx.stroke();
  }
}

function drawDisplacement(ctx: any, view: View, fit: FitStyle) {
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  const region = regionFor(view, fit);
  for (let y = Math.floor(region.y); y < region.y + region.height; y += 5) {
    const wave = Math.sin((y - region.y) / 42) * 40;
    const green = Math.cos((y - region.y) / 78) * 22;
    ctx.fillStyle = `rgb(${Math.round(128 + wave)}, ${Math.round(128 + green)}, 128)`;
    ctx.fillRect(region.x, y, region.width, 5);
  }
}

function drawPrint(ctx: any, variant: "front" | "back" | "sleeve") {
  if (variant === "sleeve") {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(250, 900, 1548, 240);
    ctx.fillStyle = "#f2f1ec";
    ctx.font = "bold 150px Arial";
    ctx.textAlign = "center";
    ctx.fillText("STUDIO", 1024, 1060);
    return;
  }

  ctx.fillStyle = variant === "front" ? "#111827" : "#f8f3e8";
  ctx.fillRect(224, 224, 1600, 1600);
  ctx.fillStyle = variant === "front" ? "#f8f3e8" : "#111827";
  ctx.fillRect(360, 360, 1328, 1328);
  ctx.fillStyle = "#e23d28";
  ctx.beginPath();
  ctx.arc(1024, 790, 270, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = variant === "front" ? "#111827" : "#f8f3e8";
  ctx.font = "bold 176px Arial";
  ctx.textAlign = "center";
  ctx.fillText(variant === "front" ? "MODEL" : "BACK", 1024, 1220);
  ctx.font = "bold 118px Arial";
  ctx.fillText("STUDIO", 1024, 1390);
}

function drawBackdrop(ctx: any, kind: "editorial" | "concrete" | "luxury") {
  const grad = ctx.createLinearGradient(0, 0, size, size);
  if (kind === "editorial") {
    grad.addColorStop(0, "#d8dfdf");
    grad.addColorStop(0.55, "#f2f1e9");
    grad.addColorStop(1, "#c9bbb0");
  } else if (kind === "concrete") {
    grad.addColorStop(0, "#6f7371");
    grad.addColorStop(0.5, "#d0d1ca");
    grad.addColorStop(1, "#8b8e89");
  } else {
    grad.addColorStop(0, "#161616");
    grad.addColorStop(0.5, "#5f5143");
    grad.addColorStop(1, "#d8c8a2");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = kind === "luxury" ? 0.14 : 0.09;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  for (let i = -size; i < size * 2; i += 112) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  await savePng("sample-print.png", withCanvas((ctx) => drawPrint(ctx, "front")));
  await savePng("sample-print-back.png", withCanvas((ctx) => drawPrint(ctx, "back")));
  await savePng("sample-sleeve-print.png", withCanvas((ctx) => drawPrint(ctx, "sleeve")));

  for (const kind of ["editorial", "concrete", "luxury"] as const) {
    await savePng(`backdrop-${kind}.png`, withCanvas((ctx) => drawBackdrop(ctx, kind)));
  }

  for (const fit of fits) {
    for (const view of views) {
      await savePng(`tee-${view}-${fit}-mask.png`, withCanvas((ctx) => drawMask(ctx, view, fit)));
      await savePng(`tee-${view}-${fit}-shadow.png`, withCanvas((ctx) => drawShadow(ctx, view, fit)));
      await savePng(`tee-${view}-${fit}-displacement.png`, withCanvas((ctx) => drawDisplacement(ctx, view, fit)));
      for (const model of models) {
        await savePng(`tee-${view}-${fit}-${model}.png`, withCanvas((ctx) => drawPlate(ctx, view, fit, model)));
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
