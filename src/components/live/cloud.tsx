import {
  useEffect,
  useRef,
} from 'react'

import type { CloudVariant } from '~/constants/cloud-paths'
import { drawAsciiCloud } from '~/constants/cloud-animate'

interface CloudProps {
  width?: string
  height?: string
  top?: string
  className?: string
  variant?: CloudVariant
}

export default function Cloud({
  width = '580px',
  height = '240px',
  top = '10%',
  className = '',
  variant = 'cloud1',
}: CloudProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null)

  const variantRef =
    useRef(variant)

  useEffect(() => {
    variantRef.current = variant
  }, [variant])

  useEffect(() => {
    const canvas =
      canvasRef.current

    if (!canvas) return

    const ctx =
      canvas.getContext('2d')

    if (!ctx) return

    let animationFrame = 0

    const startTime =
      performance.now()

    const resize = () => {
      const dpr =
        window.devicePixelRatio || 1

      const rect =
        canvas.getBoundingClientRect()

      const width =
        Math.max(
          1,
          Math.round(
            rect.width * dpr,
          ),
        )

      const height =
        Math.max(
          1,
          Math.round(
            rect.height * dpr,
          ),
        )

      canvas.width =
        width

      canvas.height =
        height
    }

    const animate = () => {
      const now =
        performance.now()

      const time =
        (now - startTime) /
        1000

      const dpr =
        window.devicePixelRatio || 1

      drawAsciiCloud(
        ctx,
        canvas.width,
        canvas.height,
        time,
        dpr,
        variantRef.current,
      )

      animationFrame =
        requestAnimationFrame(
          animate,
        )
    }

    resize()

    window.addEventListener(
      'resize',
      resize,
    )

    animationFrame =
      requestAnimationFrame(
        animate,
      )

    return () => {
      window.removeEventListener(
        'resize',
        resize,
      )

      cancelAnimationFrame(
        animationFrame,
      )
    }

  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none ${className}`}
      style={{
        top,
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