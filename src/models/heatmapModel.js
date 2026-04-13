export const ZONE_COLORS = {
  1: '#4dabf7',
  2: '#ffd43b',
  3: '#ff6b6b',
  4: '#69db7c',
  5: '#ffa94d',
  6: '#8b5cf6'
}

export const ACCURACY_HEAT_COLORS = {
  none: '#9ca3af',
  red: 'rgb(239, 68, 68)',
  orange: 'rgb(249, 115, 22)',
  yellow: 'rgb(234, 179, 8)',
  green: 'rgb(34, 197, 94)'
}

export function getZoneColor(zone) {
  return ZONE_COLORS[zone] || '#d1d5db'
}

export function getAccuracyHeatColor(accuracy, attempts) {
  if (!attempts) {
    return ACCURACY_HEAT_COLORS.none
  }

  const clamped = Math.max(0, Math.min(100, accuracy))

  if (clamped < 25) return ACCURACY_HEAT_COLORS.red
  if (clamped < 50) return ACCURACY_HEAT_COLORS.orange
  if (clamped < 75) return ACCURACY_HEAT_COLORS.yellow
  return ACCURACY_HEAT_COLORS.green
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
