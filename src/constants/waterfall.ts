// ============================================================
// ASCII / DITHERED WATERFALL2 (image-mask silhouette)
// ============================================================

// ------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------

// Size of each dither block.
const DOT_SCALE = 8

// Maximum scale applied when fitting the mask image into the
// canvas (prevents the shape from oversampling on very wide
// containers — same role as MAX_CLOUD_SCALE in cloud-animate3).
const MAX_MASK_SCALE = 2.5

// Overall animation speed.
const TIME_SCALE = 1.3

// How strongly the billow travels through the shape.
const BILLOW_STRENGTH = 0.2

// Main travelling-wave speed.
const BILLOW_SPEED = 2.4

// ------------------------------------------------------------
// EDGE WARP — displaces the mask sample point so the silhouette
// boundary itself shifts over time, instead of the dither just
// pulsing inside a static outline.
// ------------------------------------------------------------

// How far the mask boundary displaces, in canvas px (scaled by
// dpr at draw time).
const EDGE_WARP_STRENGTH = 10

// How fast the edge warp moves over time.
const EDGE_WARP_SPEED = 0.85

// Spatial frequency of the edge warp along the shape's height.
const EDGE_WARP_FREQUENCY = 6

// ------------------------------------------------------------
// SIDE-ONLY BLACK SPECKLE
// ------------------------------------------------------------

// How far out (in canvas px, scaled by dpr) from a side edge the
// speckle band extends.
const SIDE_ZONE_RADIUS = 8

// How many times per second the speckle pattern refreshes.
const SIDE_DOT_RATE = 6

// How much a cell's refresh timing shifts based on its vertical position
const SIDE_DOT_SWEEP_SPREAD = 3

// Probability [0-1] a given side-zone cell shows a black dot per
// refresh tick — kept low on purpose ("very infrequently").
const SIDE_DOT_CHANCE = 0.05

// Cheap hash-based white noise (uncorrelated between cells) —
// a real per-cell coin-flip, not a smooth gradient.
function hash3(x: number, y: number, z: number) {
  const s =
    Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123
  return s - Math.floor(s)
}

// ------------------------------------------------------------
// BAYER MATRIX
// ------------------------------------------------------------

const BAYER = [
  [0, 128, 32, 160, 8, 136, 40, 168],
  [192, 64, 224, 96, 200, 72, 232, 104],
  [48, 176, 16, 144, 56, 184, 24, 152],
  [240, 112, 208, 80, 248, 120, 216, 88],
  [12, 140, 44, 172, 4, 132, 36, 164],
  [204, 76, 236, 108, 196, 68, 228, 100],
  [60, 188, 28, 156, 52, 180, 20, 148],
  [252, 124, 220, 92, 244, 116, 212, 84],
]

// Lower = denser. Higher = sparser.
const THRESHOLD = 58

// ------------------------------------------------------------
// CACHED IMAGE MASK
// ------------------------------------------------------------

let maskCanvas: HTMLCanvasElement | null = null
let maskCtx: CanvasRenderingContext2D | null = null
let maskData: Uint8ClampedArray | null = null
let sideZoneData: Uint8Array | null = null

let cachedWidth = 0
let cachedHeight = 0
let cachedImage: HTMLImageElement | null = null
let cachedDpr = 0

// Whether a pixel counts as "inside" the mask, using a hard
// threshold — used only for side-zone detection below.
function isInsideMaskBinary(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (x < 0 || x >= width || y < 0 || y >= height) return false

  const index = (y * width + x) * 4

  return maskData !== null && (maskData[index + 3] ?? 0)> 127
}

// Marks pixels within `radius` of a LEFT/RIGHT mask transition
// only. Checking exclusively horizontal neighbors (x - radius,
// x + radius) means a transition that only shows up via a
// vertical check (top/bottom tip of the ribbon) is excluded —
// only genuine side edges get flagged.
function buildSideZone(
  width: number,
  height: number,
  radius: number,
) {
  sideZoneData = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const center = isInsideMaskBinary(x, y, width, height)

      const differsHorizontally =
        isInsideMaskBinary(x - radius, y, width, height) !== center ||
        isInsideMaskBinary(x + radius, y, width, height) !== center

      sideZoneData[y * width + x] = differsHorizontally ? 1 : 0
    }
  }
}

function sampleSideZone(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!sideZoneData) return 0

  const cx = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const cy = Math.min(height - 1, Math.max(0, Math.floor(y)))

  return sideZoneData[cy * width + cx]
}

function buildMask(
  image: HTMLImageElement,
  width: number,
  height: number,
  dpr: number,
) {
  if (!maskCanvas) {
    maskCanvas = document.createElement("canvas")

    maskCtx = maskCanvas.getContext("2d", {
      willReadFrequently: true,
    })
  }

  if (!maskCtx) return

  // Only rebuild when dimensions, the source image, or dpr
  // change (dpr affects the side-zone radius below).
  if (
    cachedWidth === width &&
    cachedHeight === height &&
    cachedImage === image &&
    cachedDpr === dpr &&
    maskData
  ) {
    return
  }

  cachedWidth = width
  cachedHeight = height
  cachedImage = image
  cachedDpr = dpr

  maskCanvas.width = width
  maskCanvas.height = height

  maskCtx.clearRect(0, 0, width, height)

  // ----------------------------------------------------------
  // RESPONSIVE SCALE — fit the mask image inside the canvas
  // (contain), capped at MAX_MASK_SCALE, and centered.
  // ----------------------------------------------------------

  const imgWidth = image.naturalWidth || image.width
  const imgHeight = image.naturalHeight || image.height

  if (!imgWidth || !imgHeight) return

  const fitScale = Math.min(
    width / imgWidth,
    height / imgHeight,
  )

  const scale = Math.min(
    MAX_MASK_SCALE,
    fitScale,
  )

  const renderedWidth = imgWidth * scale
  const renderedHeight = imgHeight * scale

  const offsetX = (width - renderedWidth) / 2
  const offsetY = (height - renderedHeight) / 2

  maskCtx.drawImage(
    image,
    offsetX,
    offsetY,
    renderedWidth,
    renderedHeight,
  )

  // Expensive operation — only happens on resize / image change.
  maskData = maskCtx.getImageData(0, 0, width, height).data

  // Also only happens on resize — tied to the same cache
  // invalidation as maskData above.
  buildSideZone(width, height, SIDE_ZONE_RADIUS * dpr)
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
) {
  if (!maskData) return 0

  const cx = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const cy = Math.min(height - 1, Math.max(0, Math.floor(y)))

  const index = (cy * width + cx) * 4

  return maskData[index + 3]
}

// ------------------------------------------------------------
// MAIN DRAW
// ------------------------------------------------------------

export function drawAsciiWaterfall(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  image: HTMLImageElement | null,
  time = 0,
  dpr = 1,
) {
  ctx.clearRect(0, 0, width, height)

  if (width <= 0 || height <= 0 || !image) {
    return
  }

  buildMask(image, width, height, dpr)

  if (!maskData) return

  const t = time * TIME_SCALE

  const warpTime = time * EDGE_WARP_SPEED

  const warpAmplitude = EDGE_WARP_STRENGTH * dpr

  // ----------------------------------------------------------
  // GRID
  // ----------------------------------------------------------

  const cols = Math.ceil(width / DOT_SCALE)
  const rows = Math.ceil(height / DOT_SCALE)

  // ----------------------------------------------------------
  // DRAW
  // ----------------------------------------------------------

  ctx.fillStyle = "white"

  for (let row = 0; row < rows; row++) {
    const bayerRow = BAYER[row & 7] ?? []

    for (let col = 0; col < cols; col++) {
      const x = col * DOT_SCALE + DOT_SCALE / 2
      const y = row * DOT_SCALE + DOT_SCALE / 2

      if (x >= width || y >= height) {
        continue
      }

      // ------------------------------------------------------
      // NORMALIZED POSITION
      // ------------------------------------------------------

      const ny = y / height

      // ------------------------------------------------------
      // EDGE WARP — a SINGLE downward-travelling term, same
      // shape as the cloud's original billow: one phase that
      // combines position and time additively (ny * frequency
      // - warpTime), so it can only ever move one direction.
      // ------------------------------------------------------

      const warpY =
        Math.sin(
          ny * EDGE_WARP_FREQUENCY - warpTime,
        ) * warpAmplitude

      const sampleX = x
      const sampleY = y + warpY

      // ------------------------------------------------------
      // MASK (sampled at the warped position)
      // ------------------------------------------------------

      const maskAlpha = sampleMaskAlpha(
        sampleX,
        sampleY,
        width,
        height,
      )

      // ------------------------------------------------------
      // SIDE-ONLY BLACK SPECKLE 

      const sideZone = sampleSideZone(
        sampleX,
        sampleY,
        width,
        height,
      )

      let drewSideDot = false

      if (sideZone) {
        //every individual cell keeps
        // its own independent random outcome within whichever
        // generation it's in — that's what keeps this looking
        // like scattered dots rather than solid bands.
        const flickerGeneration = Math.floor(
          time * SIDE_DOT_RATE -
            ny * SIDE_DOT_SWEEP_SPREAD,
        )

        const flickerValue = hash3(
          col,
          row,
          flickerGeneration,
        )

        if (flickerValue < SIDE_DOT_CHANCE) {
          ctx.fillStyle = "black"

          ctx.fillRect(
            col * DOT_SCALE,
            row * DOT_SCALE,
            DOT_SCALE,
            DOT_SCALE,
          )

          drewSideDot = true
        }
      }

      if (maskAlpha === 0) {
        continue
      }

      // ------------------------------------------------------
      // DOWNWARD BILLOW
      // ------------------------------------------------------

      const travellingWave = Math.sin(
        ny * 9 - t * BILLOW_SPEED,
      )

      const diagonalWave = Math.sin(
        ny * 15 - t * 1.15,
      )

      const localWave = Math.sin(
        ny * 30 - t * 0.75,
      )

      // ------------------------------------------------------
      // COMBINE WAVES
      // ------------------------------------------------------

      let density = 0.78

      density += travellingWave * BILLOW_STRENGTH
      density += diagonalWave * 0.10
      density += localWave * 0.045
      density *= 0.90 + 0.10 * Math.sin(t * 1.3)

      density = Math.max(0, Math.min(1, density))

      // ------------------------------------------------------
      // EDGE SOFTNESS — uses the same warped alpha so the soft
      // edge travels with the ripple instead of staying fixed.
      // ------------------------------------------------------

      const edgeSample = (maskAlpha ?? 0) / 255

      density *= 0.82 + edgeSample * 0.18

      // ------------------------------------------------------
      // BAYER
      // ------------------------------------------------------

      const threshold = THRESHOLD * density

      const bayerValue = bayerRow[col & 7] ?? 0

      if (bayerValue >= threshold) {
        continue
      }

      // Leave the side dot black rather than overdrawing it —
      // remove this to let the white fill take priority instead.
      if (drewSideDot) {
        continue
      }

      // ------------------------------------------------------
      // DRAW DITHER BLOCK
      // ------------------------------------------------------

      ctx.fillStyle = "white"

      ctx.fillRect(
        col * DOT_SCALE,
        row * DOT_SCALE,
        DOT_SCALE,
        DOT_SCALE,
      )
    }
  }
}