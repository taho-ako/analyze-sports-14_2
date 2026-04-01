export const ZONE_COLORS = {
  1: '#4dabf7',
  2: '#ffd43b',
  3: '#ff6b6b',
  4: '#69db7c',
  5: '#ffa94d',
  6: '#1fa3dd'
}

export function getZoneColor(zone) {
  return ZONE_COLORS[zone] || '#d1d5db'
}

export function getAccuracyHeatColor(accuracy, attempts) {
  if (!attempts) {
    return '#9ca3af'
  }

  const clamped = Math.max(0, Math.min(100, accuracy))
  let r
  let g

  if (clamped < 50) {
    const ratio = clamped / 50
    r = 239 + (251 - 239) * ratio
    g = 68 + (191 - 68) * ratio
  } else {
    const ratio = (clamped - 50) / 50
    r = 251 + (34 - 251) * ratio
    g = 191 + (197 - 191) * ratio
  }

  return `rgb(${Math.round(r)}, ${Math.round(g)}, 68)`
}

export function buildZoneHeatmapModel(zoneStats) {
  const safeStats = zoneStats || {}
  const maxAttempts = Math.max(
    ...Array.from({ length: 6 }, (_, idx) => safeStats[idx + 1]?.total || 0),
    1
  )

  const zones = Array.from({ length: 6 }, (_, idx) => {
    const zoneId = idx + 1
    const stats = safeStats[zoneId] || { made: 0, total: 0 }
    const accuracy = stats.total > 0 ? (stats.made / stats.total) * 100 : 0

    return {
      id: zoneId,
      label: `Zone ${zoneId}`,
      color: ZONE_COLORS[zoneId],
      made: stats.made,
      total: stats.total,
      accuracy: Number(accuracy.toFixed(1)),
      intensity: Number((stats.total / maxAttempts).toFixed(2)),
      heatColor: getAccuracyHeatColor(accuracy, stats.total)
    }
  })

  return {
    zones,
    palette: ZONE_COLORS
  }
}
