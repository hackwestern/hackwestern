// ============================================================
// ASCII / DITHERED BILLOWING CLOUD
// ============================================================

// ------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------

// Size of each dither block.
// 2 = smaller / denser
// 3 = balanced
// 4 = larger
const DOT_SCALE = 5

// Maximum size of the cloud.
const MAX_CLOUD_SCALE = 2.5

// Overall animation speed.
const TIME_SCALE = 1

// How strongly the billow travels through the cloud.
// Higher = more obvious travelling wave.
const BILLOW_STRENGTH = 0.2

// Main travelling-wave speed.
const BILLOW_SPEED = 1.8

// ------------------------------------------------------------
// EDGE WARP (this is what makes the silhouette itself shift,
// instead of just the internal dither density)
// ------------------------------------------------------------

// How far the mask boundary displaces, in CSS px (scaled by dpr
// at draw time). Higher = more obvious billowing edge.
const EDGE_WARP_STRENGTH = 9

// How fast the edge warp moves over time.
const EDGE_WARP_SPEED = 0.8

// ------------------------------------------------------------
// BAYER MATRIX
// ------------------------------------------------------------

const BAYER: number[][] = [
  [0, 128, 32, 160, 8, 136, 40, 168],
  [192, 64, 224, 96, 200, 72, 232, 104],
  [48, 176, 16, 144, 56, 184, 24, 152],
  [240, 112, 208, 80, 248, 120, 216, 88],
  [12, 140, 44, 172, 4, 132, 36, 164],
  [204, 76, 236, 108, 196, 68, 228, 100],
  [60, 188, 28, 156, 52, 180, 20, 148],
  [252, 124, 220, 92, 244, 116, 212, 84],
]

// Lower = denser.
// Higher = sparser.
const THRESHOLD = 58

// ------------------------------------------------------------
// CLOUD PATH REGISTRY
// ------------------------------------------------------------
//
// All cloud shapes live in cloud-paths.ts as plain data (path
// strings + their viewBox sizes). This file only knows how to
// draw WHICHEVER one it's told to — switching clouds is just
// passing a different `variant` value, no changes needed here.

import {
  CLOUD_PATHS,
  CLOUD_VIEWBOX_SIZES,
  type CloudVariant,
} from "./cloud-paths"

// One Path2D per variant, built lazily and cached — so switching
// back and forth between clouds doesn't rebuild a Path2D you've
// already used before.
const pathCache = new Map<CloudVariant, Path2D>()

function getCloudPath(variant: CloudVariant): Path2D {
  const cached = pathCache.get(variant)

  if (cached) {
    return cached
  }

  const path = new Path2D(CLOUD_PATHS[variant])

  pathCache.set(variant, path)

  return path
}

// ------------------------------------------------------------
// CACHED SVG MASK
// ------------------------------------------------------------

let maskCanvas: HTMLCanvasElement | null = null
let maskCtx: CanvasRenderingContext2D | null = null
let maskData: Uint8ClampedArray | null = null

let cachedWidth = 0
let cachedHeight = 0
let cachedVariant: CloudVariant | null = null

function buildMask(
  width: number,
  height: number,
  variant: CloudVariant,
): void {
  if (!maskCanvas) {
    maskCanvas = document.createElement("canvas")

    maskCtx = maskCanvas.getContext("2d", {
      willReadFrequently: true,
    })
  }

  if (!maskCtx) return

  // Only rebuild when dimensions OR the selected cloud change —
  // switching variant must invalidate the cache same as a
  // resize does, or you'd keep seeing the old silhouette.
  if (
    cachedWidth === width &&
    cachedHeight === height &&
    cachedVariant === variant &&
    maskData
  ) {
    return
  }

  cachedWidth = width
  cachedHeight = height
  cachedVariant = variant

  maskCanvas.width = width
  maskCanvas.height = height

  maskCtx.clearRect(
    0,
    0,
    width,
    height,
  )

  // ----------------------------------------------------------
  // RESPONSIVE SCALE
  // ----------------------------------------------------------

  const { width: svgWidth, height: svgHeight } =
    CLOUD_VIEWBOX_SIZES[variant]

  const cloudScale = Math.min(
    MAX_CLOUD_SCALE,
    width / svgWidth,
  )

  const renderedWidth =
    svgWidth * cloudScale

  const renderedHeight =
    svgHeight * cloudScale

  const offsetX =
    (width - renderedWidth) / 2

  const offsetY =
    (height - renderedHeight) / 2

  // ----------------------------------------------------------
  // DRAW SVG INTO MASK
  // ----------------------------------------------------------

  maskCtx.setTransform(
    cloudScale,
    0,
    0,
    cloudScale,
    offsetX,
    offsetY,
  )

  maskCtx.fillStyle = "white"

  maskCtx.fill(
    getCloudPath(variant),
  )

  maskCtx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0,
  )

  // Expensive operation — only happens on resize.
  maskData = maskCtx.getImageData(
    0,
    0,
    width,
    height,
  ).data
}

// ------------------------------------------------------------
// MASK SAMPLING HELPER
// ------------------------------------------------------------

// Reads the mask alpha at a given pixel position, clamping to
// canvas bounds so warped samples near the edge don't read
// garbage/out-of-range memory.
function sampleMaskAlpha(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  if (!maskData) return 0

  const cx = Math.min(
    width - 1,
    Math.max(0, Math.floor(x)),
  )

  const cy = Math.min(
    height - 1,
    Math.max(0, Math.floor(y)),
  )

  const index =
    (cy * width + cx) * 4

  return maskData[index + 3] ?? 0
}

// ------------------------------------------------------------
// MAIN DRAW
// ------------------------------------------------------------

export function drawAsciiCloud(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time = 0,
  dpr = 1,
  variant: CloudVariant = "cloud1",
): void {
  ctx.clearRect(
    0,
    0,
    width,
    height,
  )

  if (
    width <= 0 ||
    height <= 0
  ) {
    return
  }

  buildMask(
    width,
    height,
    variant,
  )

  if (!maskData) return

  const t =
    time * TIME_SCALE

  const warpTime =
    time * EDGE_WARP_SPEED

  const warpAmplitude =
    EDGE_WARP_STRENGTH * dpr

  // ----------------------------------------------------------
  // GRID
  // ----------------------------------------------------------

  const cols =
    Math.ceil(width / DOT_SCALE)

  const rows =
    Math.ceil(height / DOT_SCALE)

  // ----------------------------------------------------------
  // DRAW
  // ----------------------------------------------------------

  ctx.fillStyle = "white"

  for (
    let row = 0;
    row < rows;
    row++
  ) {
    // `& 7` always yields 0-7, and BAYER has exactly 8 rows, so
    // this is always defined at runtime — the `?? []` fallback
    // exists purely to satisfy noUncheckedIndexedAccess.
    const bayerRow =
      BAYER[row & 7] ?? []

    for (
      let col = 0;
      col < cols;
      col++
    ) {
      const x =
        col * DOT_SCALE +
        DOT_SCALE / 2

      const y =
        row * DOT_SCALE +
        DOT_SCALE / 2

      if (
        x >= width ||
        y >= height
      ) {
        continue
      }

      // ------------------------------------------------------
      // NORMALIZED POSITION
      // ------------------------------------------------------

      const nx =
        x / width

      const ny =
        y / height

      // ------------------------------------------------------
      // EDGE WARP — displace the sampling point so the
      // silhouette boundary itself ripples over time, instead
      // of staying pinned to the static SVG outline.
      // ------------------------------------------------------

      const warpX =
        (
          Math.sin(
            ny * 8 +
            warpTime * 1.3,
          ) * 0.6 +
          Math.sin(
            ny * 17 -
            warpTime * 0.7 +
            nx * 4,
          ) * 0.4
        ) * warpAmplitude

      const warpY =
        (
          Math.cos(
            nx * 7 -
            warpTime * 1.1,
          ) * 0.6 +
          Math.sin(
            nx * 19 +
            warpTime * 0.9 +
            ny * 5,
          ) * 0.4
        ) * warpAmplitude

      const sampleX =
        x + warpX

      const sampleY =
        y + warpY

      // ------------------------------------------------------
      // CLOUD MASK (sampled at the warped position)
      // ------------------------------------------------------

      const maskAlpha =
        sampleMaskAlpha(
          sampleX,
          sampleY,
          width,
          height,
        )

      if (maskAlpha === 0) {
        continue
      }

      // ------------------------------------------------------
      // TRAVELLING BILLOW
      // ------------------------------------------------------

      // Main horizontal wave.
      //
      // This is the important difference from the previous
      // version: the wave MOVES through the cloud instead
      // of the entire cloud pulsing simultaneously.
      const travellingWave =
        Math.sin(
          nx * 9 +
          t * BILLOW_SPEED +
          ny * 2.5,
        )

      // Second slower diagonal wave.
      const diagonalWave =
        Math.sin(
          nx * 15 +
          ny * 8 -
          t * 1.15,
        )

      // Smaller local movement.
      const localWave =
        Math.sin(
          nx * 30 -
          ny * 11 +
          t * 0.75,
        )

      // ------------------------------------------------------
      // COMBINE WAVES
      // ------------------------------------------------------

      let density =
        0.78

      density +=
        travellingWave *
        BILLOW_STRENGTH

      density +=
        diagonalWave *
        0.10

      density +=
        localWave *
        0.045

      // Slow global breathing.
      density *=
        0.90 +
        0.10 *
          Math.sin(
            t * 1.3,
          )

      density =
        Math.max(
          0,
          Math.min(
            1,
            density,
          ),
        )

      // ------------------------------------------------------
      // EDGE SOFTNESS
      // ------------------------------------------------------

      // Sample nearby pixels to make the cloud boundary
      // slightly softer instead of having a perfectly hard
      // silhouette. Uses the same warped alpha so the soft
      // edge travels with the ripple instead of staying fixed.
      const edgeSample =
        maskAlpha / 255

      density *=
        0.82 +
        edgeSample * 0.18

      // ------------------------------------------------------
      // BAYER
      // ------------------------------------------------------

      const threshold =
        THRESHOLD *
        density

      // Same reasoning as bayerRow above — `col & 7` is always
      // 0-7, and bayerRow always has 8 elements, so this is
      // always defined at runtime.
      const bayerValue =
        bayerRow[col & 7] ?? 0

      if (
        bayerValue >=
        threshold
      ) {
        continue
      }

      // ------------------------------------------------------
      // DRAW DITHER BLOCK
      // ------------------------------------------------------

      ctx.fillRect(
        col * DOT_SCALE,
        row * DOT_SCALE,
        DOT_SCALE,
        DOT_SCALE,
      )
    }
  }
}