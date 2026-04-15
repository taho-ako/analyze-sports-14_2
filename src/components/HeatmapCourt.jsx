import { useEffect, useRef, useState } from 'react'
import { buildZoneHeatmapModel, ZONE_COLORS } from '../models/heatmapModel'

const hexToRgb = (hex) => {
  const sanitized = hex.replace('#', '')
  const bigint = Number.parseInt(sanitized, 16)
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  }
}

const ZONE_RGB = Object.fromEntries(
  Object.entries(ZONE_COLORS).map(([zone, hex]) => [zone, hexToRgb(hex)])
)

const ZONE_SEED_POINTS = {
  1: [[0.5, 0.2], [0.5, 0.3]],
  2: [[0.23, 0.2], [0.3, 0.3]],
  3: [[0.74, 0.2], [0.68, 0.35]],
  4: [[0.1, 0.55], [0.14, 0.8]],
  5: [[0.5, 0.8], [0.45, 0.72]],
  6: [[0.9, 0.55], [0.87, 0.8]]
}

const parseRgbString = (rgbString) => {
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) {
    return { r: 156, g: 163, b: 175 }
  }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3])
  }
}

const DEBUG_ZONE_COLORS = {
  1: [77, 171, 247],
  2: [255, 212, 59],
  3: [255, 107, 107],
  4: [105, 219, 124],
  5: [255, 169, 77],
  6: [139, 92, 246]
}

const MIN_COLOR_BRIGHTNESS = 75
const MAX_ZONE_DISTANCE = 9000

function HeatmapCourt({ zoneStats, title = 'Shot Heatmap' }) {
  const heatmap = buildZoneHeatmapModel(zoneStats)
  const [zoneMap, setZoneMap] = useState(null)
  const [showDebugOverlay, setShowDebugOverlay] = useState(false)
  const overlayCanvasRef = useRef(null)
  const debugCanvasRef = useRef(null)

  useEffect(() => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = '/real zone colors.jpg'

    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight

      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = width
      sourceCanvas.height = height
      const sourceCtx = sourceCanvas.getContext('2d')
      if (!sourceCtx) return

      sourceCtx.drawImage(image, 0, 0, width, height)
      const sourceData = sourceCtx.getImageData(0, 0, width, height)

      const zoneByPixel = new Uint8Array(width * height)

      const isNearWhiteOrBlack = (r, g, b) => {
        const isNearWhite = r > 235 && g > 235 && b > 235
        const isNearBlack = r < MIN_COLOR_BRIGHTNESS && g < MIN_COLOR_BRIGHTNESS && b < MIN_COLOR_BRIGHTNESS
        return isNearWhite || isNearBlack
      }

      const getPixelRgb = (x, y) => {
        const px = Math.max(0, Math.min(width - 1, x))
        const py = Math.max(0, Math.min(height - 1, y))
        const idx = (py * width + px) * 4
        return {
          r: sourceData.data[idx],
          g: sourceData.data[idx + 1],
          b: sourceData.data[idx + 2],
          a: sourceData.data[idx + 3]
        }
      }

      const sampleZoneReferenceColors = () => {
        const refs = {}

        for (let z = 1; z <= 6; z++) {
          const seeds = ZONE_SEED_POINTS[z]
          let samples = []

          for (const [nx, ny] of seeds) {
            const sx = Math.round(nx * (width - 1))
            const sy = Math.round(ny * (height - 1))

            for (let radius = 0; radius <= 8; radius++) {
              let found = false
              for (let oy = -radius; oy <= radius && !found; oy++) {
                for (let ox = -radius; ox <= radius && !found; ox++) {
                  const pixel = getPixelRgb(sx + ox, sy + oy)
                  if (pixel.a < 10) continue
                  if (isNearWhiteOrBlack(pixel.r, pixel.g, pixel.b)) continue

                  samples.push({ r: pixel.r, g: pixel.g, b: pixel.b })
                  found = true
                }
              }
              if (found) break
            }
          }

          if (samples.length === 0) {
            refs[z] = ZONE_RGB[z]
          } else {
            const avg = samples.reduce(
              (acc, pixel) => ({ r: acc.r + pixel.r, g: acc.g + pixel.g, b: acc.b + pixel.b }),
              { r: 0, g: 0, b: 0 }
            )
            refs[z] = {
              r: Math.round(avg.r / samples.length),
              g: Math.round(avg.g / samples.length),
              b: Math.round(avg.b / samples.length)
            }
          }
        }

        return refs
      }

      const sampledZoneRgb = sampleZoneReferenceColors()

      const getZoneByPixel = (r, g, b) => {
        if (isNearWhiteOrBlack(r, g, b)) {
          return null
        }

        const maxChannel = Math.max(r, g, b)
        if (maxChannel < MIN_COLOR_BRIGHTNESS) {
          return null
        }

        let closestZone = null
        let minDistance = Number.POSITIVE_INFINITY

        for (let z = 1; z <= 6; z++) {
          const target = sampledZoneRgb[z]
          const dr = r - target.r
          const dg = g - target.g
          const db = b - target.b
          const distance = dr * dr + dg * dg + db * db

          if (distance < minDistance) {
            minDistance = distance
            closestZone = z
          }
        }

        if (minDistance > MAX_ZONE_DISTANCE) {
          return null
        }

        return closestZone
      }

      for (let idx = 0; idx < sourceData.data.length; idx += 4) {
        const alpha = sourceData.data[idx + 3]
        if (alpha < 10) continue

        const r = sourceData.data[idx]
        const g = sourceData.data[idx + 1]
        const b = sourceData.data[idx + 2]
        const zone = getZoneByPixel(r, g, b)

        if (!zone) continue

        zoneByPixel[idx / 4] = zone
      }

      const smoothZones = (source) => {
        const result = source.slice()

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const index = y * width + x
            const currentZone = source[index]
            if (!currentZone) continue

            const orthogonalNeighbors = [
              source[y * width + (x - 1)],
              source[y * width + (x + 1)],
              source[(y - 1) * width + x],
              source[(y + 1) * width + x]
            ]
            const sameOrthogonalCount = orthogonalNeighbors.filter(z => z === currentZone).length

            // Preserve thin but coherent regions (like narrow side strips).
            if (sameOrthogonalCount > 0) {
              continue
            }

            const counts = [0, 0, 0, 0, 0, 0, 0]
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                if (ox === 0 && oy === 0) continue
                const neighborZone = source[(y + oy) * width + (x + ox)]
                if (neighborZone) counts[neighborZone]++
              }
            }

            let majorityZone = currentZone
            let majorityCount = 0
            for (let z = 1; z <= 6; z++) {
              if (counts[z] > majorityCount) {
                majorityCount = counts[z]
                majorityZone = z
              }
            }

            const currentCount = counts[currentZone]
            if (majorityZone !== currentZone && majorityCount >= 7 && currentCount <= 1) {
              result[index] = majorityZone
            }
          }
        }

        return result
      }

      const smoothedOnce = smoothZones(zoneByPixel)

      setZoneMap({ width, height, zoneByPixel: smoothedOnce })
    }
  }, [])

  useEffect(() => {
    if (!zoneMap || !overlayCanvasRef.current) {
      return
    }

    const canvas = overlayCanvasRef.current
    canvas.width = zoneMap.width
    canvas.height = zoneMap.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const heatByZone = {}
    heatmap.zones.forEach(zone => {
      const rgb = parseRgbString(zone.heatColor)
      const alpha = zone.total > 0 ? Math.min(0.92, 0.62 + zone.intensity * 0.28) : 0
      heatByZone[zone.id] = { ...rgb, alpha: Math.round(alpha * 255) }
    })

    const imageData = ctx.createImageData(zoneMap.width, zoneMap.height)
    for (let i = 0; i < zoneMap.zoneByPixel.length; i++) {
      const zoneId = zoneMap.zoneByPixel[i]
      if (!zoneId) continue

      const color = heatByZone[zoneId]
      if (!color || color.alpha === 0) continue

      const pixel = i * 4
      imageData.data[pixel] = color.r
      imageData.data[pixel + 1] = color.g
      imageData.data[pixel + 2] = color.b
      imageData.data[pixel + 3] = color.alpha
    }

    ctx.clearRect(0, 0, zoneMap.width, zoneMap.height)
    ctx.putImageData(imageData, 0, 0)
  }, [zoneMap, heatmap])

  useEffect(() => {
    if (!zoneMap || !debugCanvasRef.current) {
      return
    }

    const canvas = debugCanvasRef.current
    canvas.width = zoneMap.width
    canvas.height = zoneMap.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    if (!showDebugOverlay) {
      ctx.clearRect(0, 0, zoneMap.width, zoneMap.height)
      return
    }

    const imageData = ctx.createImageData(zoneMap.width, zoneMap.height)
    for (let i = 0; i < zoneMap.zoneByPixel.length; i++) {
      const zoneId = zoneMap.zoneByPixel[i]
      if (!zoneId) continue

      const [r, g, b] = DEBUG_ZONE_COLORS[zoneId] || [255, 255, 255]
      const pixel = i * 4
      imageData.data[pixel] = r
      imageData.data[pixel + 1] = g
      imageData.data[pixel + 2] = b
      imageData.data[pixel + 3] = 190
    }

    ctx.clearRect(0, 0, zoneMap.width, zoneMap.height)
    ctx.putImageData(imageData, 0, 0)
  }, [showDebugOverlay, zoneMap])

  return (
    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '10px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ marginTop: 0, marginBottom: 0, color: '#4fa3ff' }}>{title}</h2>
        <button
          onClick={() => setShowDebugOverlay(prev => !prev)}
          style={{
            backgroundColor: showDebugOverlay ? '#16a34a' : '#1e3a5f',
            border: '1px solid rgba(79, 163, 255, 0.45)',
            borderRadius: '8px',
            padding: '0.32rem 0.55rem',
            fontSize: '0.75rem'
          }}
        >
          {showDebugOverlay ? 'Hide Zone-ID Debug' : 'Show Zone-ID Debug'}
        </button>
      </div>

      <div style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '465 / 436' }}>
          <img
            src="/new background heatmap.jpg"
            alt="Basketball court heatmap background"
            style={{ width: '100%', height: '100%', borderRadius: '10px', border: '1px solid rgba(79, 163, 255, 0.35)' }}
          />
          <canvas
            ref={overlayCanvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
          <canvas
            ref={debugCanvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: showDebugOverlay ? 0.85 : 0
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.45rem' }}>
        {heatmap.zones.map(zone => (
          <div key={zone.id} style={{ borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.35)', padding: '0.45rem 0.55rem', backgroundColor: 'rgba(12, 30, 56, 0.45)' }}>
            <div style={{ fontWeight: 700 }}>{zone.label}</div>
            <div style={{ fontSize: '0.82rem' }}>Made/Total: {zone.made}/{zone.total}</div>
            <div style={{ fontSize: '0.82rem' }}>Accuracy: {zone.accuracy}%</div>
          </div>
        ))}
      </div>

      <p style={{ marginBottom: 0, marginTop: '0.7rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)' }}>
        Heat scale: red = 0-25%, orange = 25-50%, yellow = 50-75%, green = 75-100%.
      </p>
    </div>
  )
}

export default HeatmapCourt
