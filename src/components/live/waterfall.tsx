import {
  useEffect,
  useRef,
} from 'react'

import { drawAsciiWaterfall } from '~/constants/waterfall'

interface WaterfallProps {
  width?: string
  height?: string
  top?: string
  left?: string
  className?: string
}

export default function Waterfall({
  width = '66px',
  height = '606px',
  top = '10%',
  left = '38px',
  className = '',
}: WaterfallProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null)

  const maskImageRef =
    useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const canvas =
      canvasRef.current

    if (!canvas) return

    const ctx =
      canvas.getContext('2d')

    if (!ctx) return

    let animationFrame = 0
    let isMounted = true

    const startTime =
      performance.now()

    const maskImage = new Image()

    maskImage.src = '/landing/waterfall-mask.png'

    maskImage.onload = () => {
      if (isMounted) {
        maskImageRef.current = maskImage
      }
    }

    maskImage.onerror = () => {
      console.error(
        `Waterfall: failed to load mask image at "${maskImage.src}". Check that waterfall-mask.png is in public/landing/ and the path matches exactly.`,
      )
    }

    const resizeCanvas = () => {
      const dpr =
        window.devicePixelRatio || 1

      const rect =
        canvas.getBoundingClientRect()

      canvas.width = Math.max(
        1,
        Math.round(rect.width * dpr),
      )

      canvas.height = Math.max(
        1,
        Math.round(rect.height * dpr),
      )
    }

    const animate = () => {
      const now =
        performance.now()

      const time =
        (now - startTime) / 1000

      const dpr =
        window.devicePixelRatio || 1

      drawAsciiWaterfall(
        ctx,
        canvas.width,
        canvas.height,
        maskImageRef.current,
        time,
        dpr,
      )

      animationFrame =
        requestAnimationFrame(animate)
    }

    resizeCanvas()

    const resizeObserver =
      new ResizeObserver(resizeCanvas)

    resizeObserver.observe(canvas)

    animationFrame =
      requestAnimationFrame(animate)

    return () => {
      isMounted = false

      maskImage.onload = null
      maskImage.onerror = null

      resizeObserver.disconnect()

      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none ${className}`}
      style={{
        top,
        left,
        width,
        height,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
}