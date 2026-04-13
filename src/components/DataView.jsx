import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { ZONE_COLORS, getAccuracyHeatColor } from '../models/heatmapModel'
import HeatmapCourt from './HeatmapCourt'

function DataView() {
  const [playerStats, setPlayerStats] = useState([])
  const [teamStats, setTeamStats] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [selectedRound, setSelectedRound] = useState(1)
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false)
  const [hoveredZonePlayerKey, setHoveredZonePlayerKey] = useState(null)

  const calculateStats = useCallback((playersData, teamsData, round) => {
    const pStats = playersData.map(player => {
      const shots = (player.shots || []).filter(s => (s.round || 1) === round)
      const totalShots = shots.length
      const totalMade = shots.filter(s => s.made).length
      const totalPoints = shots.reduce((sum, s) => sum + s.points, 0)
      const accuracy = totalShots > 0 ? (totalMade / totalShots * 100).toFixed(1) : '0.0'

      const zoneStats = {}
      for (let z = 1; z <= 6; z++) {
        const zoneShots = shots.filter(s => s.zone === z)
        const zoneMade = zoneShots.filter(s => s.made).length
        zoneStats[z] = {
          made: zoneMade,
          total: zoneShots.length,
          accuracy: zoneShots.length > 0 ? (zoneMade / zoneShots.length * 100).toFixed(1) : '0.0'
        }
      }

      return {
        id: player.id,
        name: player.name,
        team: player.teams?.name || 'Unassigned',
        totalShots,
        totalMade,
        totalPoints,
        accuracy,
        zoneStats
      }
    })
    setPlayerStats(pStats)

    const tStats = teamsData.map(team => {
      const teamPlayers = pStats.filter(p => p.team === team.name)
      const totalShots = teamPlayers.reduce((sum, p) => sum + p.totalShots, 0)
      const totalMade = teamPlayers.reduce((sum, p) => sum + p.totalMade, 0)
      const totalPoints = teamPlayers.reduce((sum, p) => sum + p.totalPoints, 0)
      const accuracy = totalShots > 0 ? (totalMade / totalShots * 100).toFixed(1) : '0.0'

      return {
        id: team.id,
        name: team.name,
        totalShots,
        totalMade,
        totalPoints,
        accuracy
      }
    })
    setTeamStats(tStats)
  }, [])

  const fetchData = useCallback(async () => {
    let playersData, teamsData
    if (supabase) {
      // Fetch players with shots
      const { data: pData, error: playersError } = await supabase
        .from('players')
        .select('*, teams(name), shots(*)')
      if (playersError) console.error(playersError)
      playersData = pData

      // Fetch teams
      const { data: tData, error: teamsError } = await supabase.from('teams').select('*')
      if (teamsError) console.error(teamsError)
      teamsData = tData
    } else {
      teamsData = JSON.parse(localStorage.getItem('teams') || '[]')
      const shots = JSON.parse(localStorage.getItem('shots') || '[]')
      playersData = teamsData.flatMap(team =>
        team.players.map(player => ({
          ...player,
          teams: { name: team.name },
          shots: shots.filter(shot => shot.player_id === player.id)
        }))
      )
    }

    // Calculate stats
    if (playersData && teamsData) {
      setTeams(teamsData)
      calculateStats(playersData, teamsData, selectedRound)
    }
  }, [calculateStats, selectedRound])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setSelectedTeam(null)
    setSelectedPlayerId(null)
    setShowFullLeaderboard(false)
    setHoveredZonePlayerKey(null)
  }, [selectedRound])

  const COLORS = [
    '#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4',
    '#e11d48', '#14b8a6', '#84cc16', '#f97316', '#3b82f6', '#ec4899',
    '#10b981', '#8b5cf6', '#f43f5e', '#0ea5e9', '#65a30d', '#d97706'
  ]

  // Build zone totals where each stacked segment is a player who made shots in that zone.
  const getZoneMadeByPlayerData = (stats) => {
    const contributingPlayers = [...stats]
      .filter(player => player.totalMade > 0)
      .sort((a, b) => {
        if (b.totalMade !== a.totalMade) return b.totalMade - a.totalMade
        return a.name.localeCompare(b.name)
      })

    const playerSeries = contributingPlayers.map(player => ({
      id: player.id,
      name: player.name,
      dataKey: `player_${player.id}`
    }))

    const zoneRows = Array.from({ length: 6 }, (_, index) => {
      const zoneNumber = index + 1
      const row = { zone: `Zone ${zoneNumber}` }

      contributingPlayers.forEach(player => {
        const dataKey = `player_${player.id}`
        row[dataKey] = player.zoneStats[zoneNumber]?.made || 0
      })

      return row
    })

    return { zoneRows, playerSeries }
  }

  // Get point contributions data (for pie chart)
  const getPointContributions = (stats) => {
    return stats.map(player => ({
      name: player.name,
      value: player.totalPoints
    })).filter(item => item.value > 0)
  }

  // Get zone shot distribution data (for pie chart)
  const getZoneShotContributions = (stats) => {
    const zoneShots = { 'Zone 1': 0, 'Zone 2': 0, 'Zone 3': 0, 'Zone 4': 0, 'Zone 5': 0, 'Zone 6': 0 }
    stats.forEach(player => {
      for (let z = 1; z <= 6; z++) {
        const zoneTotal = player.zoneStats[z]?.total || 0
        zoneShots[`Zone ${z}`] += zoneTotal
      }
    })

    return Object.entries(zoneShots)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
  }

  const getCombinedZoneStats = (stats) => {
    const combined = {}

    for (let z = 1; z <= 6; z++) {
      combined[z] = { made: 0, total: 0 }
    }

    stats.forEach(player => {
      for (let z = 1; z <= 6; z++) {
        combined[z].made += player.zoneStats[z]?.made || 0
        combined[z].total += player.zoneStats[z]?.total || 0
      }
    })

    return combined
  }

  const getAccuracyCellStyle = (zoneStat) => {
    const attempts = zoneStat?.total || 0
    const accuracy = Number(zoneStat?.accuracy || 0)
    const heatColor = getAccuracyHeatColor(accuracy, attempts)

    const rgbMatch = heatColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    const backgroundColor = rgbMatch
      ? `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${attempts > 0 ? 0.5 : 0.22})`
      : heatColor

    return {
      backgroundColor,
      color: '#0f172a',
      fontWeight: 700
    }
  }

  const getRoundOneLeaderboard = (stats) => {
    return [...stats]
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
        if (Number(b.accuracy) !== Number(a.accuracy)) return Number(b.accuracy) - Number(a.accuracy)
        if (b.totalMade !== a.totalMade) return b.totalMade - a.totalMade
        return a.name.localeCompare(b.name)
      })
      .map((player, index) => ({
        ...player,
        rank: index + 1
      }))
  }

  const filteredPlayerStats = selectedRound === 1
    ? (selectedPlayerId ? playerStats.filter(player => player.id === selectedPlayerId) : playerStats)
    : (selectedTeam ? playerStats.filter(player => player.team === selectedTeam.name) : playerStats)
  const finalTeamStats = selectedRound === 2
    ? (selectedTeam ? teamStats.filter(team => team.name === selectedTeam.name) : teamStats)
    : []
  const { zoneRows: zoneMadeByPlayerData, playerSeries: zoneMadePlayerSeries } = getZoneMadeByPlayerData(filteredPlayerStats)
  const pointContributions = getPointContributions(filteredPlayerStats)
  const zoneShotContributions = getZoneShotContributions(filteredPlayerStats)
  const zoneHeatmapStats = getCombinedZoneStats(filteredPlayerStats)
  const teamPointsData = finalTeamStats.map(team => ({
    name: team.name,
    points: team.totalPoints
  }))
  const roundOneLeaderboard = getRoundOneLeaderboard(playerStats)
  const leaderboardPreviewCount = 6
  const visibleRoundOneLeaderboard = showFullLeaderboard
    ? roundOneLeaderboard
    : roundOneLeaderboard.slice(0, leaderboardPreviewCount)
  const hasMoreLeaderboardRows = roundOneLeaderboard.length > leaderboardPreviewCount
  const hoveredZonePlayerIndex = zoneMadePlayerSeries.findIndex(series => series.dataKey === hoveredZonePlayerKey)
  const hoveredZonePlayerSeries = hoveredZonePlayerIndex >= 0 ? zoneMadePlayerSeries[hoveredZonePlayerIndex] : null
  const hoveredZonePlayerStats = hoveredZonePlayerSeries
    ? filteredPlayerStats.find(player => String(player.id) === String(hoveredZonePlayerSeries.id))
    : null
  const hoveredZonePlayerColor = hoveredZonePlayerIndex >= 0
    ? COLORS[hoveredZonePlayerIndex % COLORS.length]
    : '#4fa3ff'
  const hoveredZonePlayerMissed = hoveredZonePlayerStats
    ? Math.max(hoveredZonePlayerStats.totalShots - hoveredZonePlayerStats.totalMade, 0)
    : 0
  const hoveredZonePlayerAccuracy = hoveredZonePlayerStats
    ? Math.max(0, Math.min(100, Number(hoveredZonePlayerStats.accuracy || 0)))
    : 0
  const hoveredZonePlayerAccuracyColor = hoveredZonePlayerStats
    ? getAccuracyHeatColor(hoveredZonePlayerAccuracy, hoveredZonePlayerStats.totalShots)
    : '#9ca3af'
  const selectedRoundOnePlayer = selectedPlayerId
    ? playerStats.find(player => player.id === selectedPlayerId)
    : null
  const heatmapScopeLabel = selectedRound === 1
    ? (selectedRoundOnePlayer ? selectedRoundOnePlayer.name : 'All Players')
    : (selectedTeam ? selectedTeam.name : 'All Teams')

  const renderZoneMadeTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null

    const rows = payload
      .filter(item => Number(item.value) > 0)
      .sort((a, b) => Number(b.value) - Number(a.value))

    if (rows.length === 0) return null

    const totalMade = rows.reduce((sum, row) => sum + Number(row.value), 0)

    return (
      <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(79, 163, 255, 0.5)', borderRadius: '8px', padding: '0.55rem 0.65rem', minWidth: '170px' }}>
        <p style={{ margin: 0, color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>{label}</p>
        <div style={{ marginTop: '0.35rem', display: 'grid', gap: '0.22rem' }}>
          {rows.map(row => (
            <div key={`${label}-${row.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'rgba(255, 255, 255, 0.86)', fontSize: '0.79rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '999px', backgroundColor: row.color }} />
                {row.name}
              </span>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.79rem' }}>{row.value}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '0.35rem 0 0', color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700 }}>
          Total made: {totalMade}
        </p>
      </div>
    )
  }

  const getZoneBarFillOpacity = (dataKey) => {
    if (!hoveredZonePlayerKey) return 0.92
    return hoveredZonePlayerKey === dataKey ? 1 : 0.18
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0.75rem', backgroundColor: 'transparent' }}>
      <h1>Data View</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
        <h2 style={{marginTop: 0, color: '#ffffff'}}>Round View</h2>
        <p style={{marginTop: 0, color: 'rgba(255, 255, 255, 0.8)'}}>
          Round 1 focuses on individual leaderboard points. Round 2 keeps team and player analytics with team point charts.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: '0.6rem', maxWidth: '340px' }}>
          {[1, 2].map(round => (
            <button
              key={round}
              onClick={() => setSelectedRound(round)}
              style={{
                padding: '0.55rem 0.8rem',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid',
                borderColor: selectedRound === round ? '#4fa3ff' : 'rgba(79, 163, 255, 0.3)',
                backgroundColor: selectedRound === round ? 'rgba(79, 163, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Round {round}
            </button>
          ))}
        </div>
      </div>

      {selectedRound === 1 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h2 style={{marginTop: 0, marginBottom: '0.65rem', color: '#ffffff'}}>Round 1 Leaderboard (Individual)</h2>
            {hasMoreLeaderboardRows && (
              <button
                onClick={() => setShowFullLeaderboard(prev => !prev)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.82rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(79, 163, 255, 0.7)',
                  backgroundColor: 'rgba(79, 163, 255, 0.22)',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                {showFullLeaderboard ? 'Show Less' : `Show All (${roundOneLeaderboard.length})`}
              </button>
            )}
          </div>

          {roundOneLeaderboard.length === 0 ? (
            <p style={{ margin: 0 }}>No round 1 shots recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxWidth: '760px' }}>
              {visibleRoundOneLeaderboard.map(player => {
                return (
                  <div
                    key={`vertical-leaderboard-${player.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr auto',
                      alignItems: 'center',
                      gap: '0.55rem',
                      backgroundColor: 'rgba(79, 163, 255, 0.12)',
                      border: '1px solid rgba(79, 163, 255, 0.35)',
                      borderRadius: '10px',
                      padding: '0.45rem 0.7rem'
                    }}
                  >
                    <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: '0.9rem' }}>#{player.rank}</span>
                    <div>
                      <p style={{ margin: 0, color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                        {player.name}
                      </p>
                      <p style={{ margin: '0.12rem 0 0', color: 'rgba(255, 255, 255, 0.72)', fontSize: '0.78rem' }}>
                        {player.team} | {player.accuracy}%
                      </p>
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        minWidth: '66px',
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '999px',
                        padding: '0.18rem 0.52rem'
                      }}
                    >
                      {player.totalPoints} pts
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Round Filter Selection */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
          {selectedRound === 1 ? (
            <>
              <h2 style={{marginTop: 0, color: '#ffffff'}}>Select Player (Round 1)</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  onClick={() => setSelectedPlayerId(null)}
                  style={{
                    padding: '0.45em 0.8em',
                    backgroundColor: selectedPlayerId === null ? '#0066cc' : 'rgba(0, 102, 204, 0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: selectedPlayerId === null ? '600' : '500'
                  }}
                >
                  All Players
                </button>
                {roundOneLeaderboard.map(player => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    style={{
                      padding: '0.45em 0.8em',
                      backgroundColor: selectedPlayerId === player.id ? '#0066cc' : 'rgba(0, 102, 204, 0.5)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: selectedPlayerId === player.id ? '600' : '500'
                    }}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 style={{marginTop: 0, color: '#ffffff'}}>Select Team (Round 2)</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button 
                  onClick={() => setSelectedTeam(null)}
                  style={{
                    padding: '0.45em 0.8em',
                    backgroundColor: selectedTeam === null ? '#0066cc' : 'rgba(0, 102, 204, 0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: selectedTeam === null ? '600' : '500'
                  }}
                >
                  All Teams
                </button>
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    style={{
                      padding: '0.45em 0.8em',
                      backgroundColor: selectedTeam?.id === team.id ? '#0066cc' : 'rgba(0, 102, 204, 0.5)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: selectedTeam?.id === team.id ? '600' : '500'
                    }}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {playerStats.length === 0 ? (
        <p>No shots have been recorded for round {selectedRound} yet.</p>
      ) : (
        <>
          {filteredPlayerStats.length > 0 && (
            <>
              <HeatmapCourt
                zoneStats={zoneHeatmapStats}
                title={`${heatmapScopeLabel} Accuracy Heatmap (Round ${selectedRound})`}
              />

              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
                <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Made Shots by Zone (Player Breakdown)</h2>
                {zoneMadePlayerSeries.length === 0 ? (
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.75)' }}>No made shots yet for the current selection.</p>
                ) : (
                  <>
                    <div
                      style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.3rem', marginBottom: '0.45rem' }}
                      onMouseLeave={() => setHoveredZonePlayerKey(null)}
                    >
                      {zoneMadePlayerSeries.map((series, index) => (
                        <button
                          key={`legend-chip-${series.dataKey}`}
                          type="button"
                          onMouseEnter={() => setHoveredZonePlayerKey(series.dataKey)}
                          onFocus={() => setHoveredZonePlayerKey(series.dataKey)}
                          onBlur={() => setHoveredZonePlayerKey(null)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.32rem',
                            whiteSpace: 'nowrap',
                            padding: '0.24rem 0.52rem',
                            borderRadius: '999px',
                            border: hoveredZonePlayerKey === series.dataKey
                              ? '1px solid rgba(255, 255, 255, 0.72)'
                              : '1px solid rgba(255, 255, 255, 0.2)',
                            backgroundColor: hoveredZonePlayerKey === series.dataKey
                              ? 'rgba(79, 163, 255, 0.32)'
                              : 'rgba(255, 255, 255, 0.04)',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            cursor: 'pointer',
                            opacity: !hoveredZonePlayerKey || hoveredZonePlayerKey === series.dataKey ? 1 : 0.55,
                            transition: 'all 0.15s ease'
                          }}
                          title={`Highlight ${series.name} shots in chart`}
                        >
                          <span style={{ width: '9px', height: '9px', borderRadius: '999px', backgroundColor: COLORS[index % COLORS.length] }} />
                          {series.name}
                        </button>
                      ))}
                    </div>

                    {hoveredZonePlayerStats && (
                      <div
                        style={{
                          marginBottom: '0.55rem',
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          border: `1px solid ${hoveredZonePlayerColor}`,
                          backgroundColor: 'rgba(15, 23, 42, 0.45)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem' }}>{hoveredZonePlayerStats.name}</span>
                          <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '0.76rem' }}>{hoveredZonePlayerStats.team}</span>
                        </div>

                        <div style={{ marginTop: '0.45rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span style={{ color: 'rgba(255, 255, 255, 0.78)', fontSize: '0.74rem' }}>Accuracy</span>
                            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.78rem' }}>{hoveredZonePlayerStats.accuracy}%</span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${hoveredZonePlayerAccuracy}%`,
                                height: '100%',
                                backgroundColor: hoveredZonePlayerAccuracyColor
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: '0.45rem', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.3rem' }}>
                          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.24rem 0.35rem' }}>
                            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.67rem' }}>PTS</p>
                            <p style={{ margin: '0.06rem 0 0', color: '#ffffff', fontWeight: 700, fontSize: '0.79rem' }}>{hoveredZonePlayerStats.totalPoints}</p>
                          </div>
                          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.24rem 0.35rem' }}>
                            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.67rem' }}>MADE</p>
                            <p style={{ margin: '0.06rem 0 0', color: '#ffffff', fontWeight: 700, fontSize: '0.79rem' }}>{hoveredZonePlayerStats.totalMade}</p>
                          </div>
                          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.24rem 0.35rem' }}>
                            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.67rem' }}>MISSED</p>
                            <p style={{ margin: '0.06rem 0 0', color: '#ffffff', fontWeight: 700, fontSize: '0.79rem' }}>{hoveredZonePlayerMissed}</p>
                          </div>
                          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.24rem 0.35rem' }}>
                            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.67rem' }}>ATT</p>
                            <p style={{ margin: '0.06rem 0 0', color: '#ffffff', fontWeight: 700, fontSize: '0.79rem' }}>{hoveredZonePlayerStats.totalShots}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <ResponsiveContainer width="100%" height={290}>
                      <BarChart data={zoneMadeByPlayerData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="zone" stroke="#ffffff" tickLine={false} tick={{ fontSize: 12 }} />
                        <YAxis stroke="#ffffff" allowDecimals={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip content={renderZoneMadeTooltip} cursor={{ fill: 'rgba(79, 163, 255, 0.12)' }} />
                        {zoneMadePlayerSeries.map((series, index) => (
                          <Bar
                            key={series.dataKey}
                            dataKey={series.dataKey}
                            stackId="zoneMade"
                            fill={COLORS[index % COLORS.length]}
                            name={series.name}
                            maxBarSize={48}
                            fillOpacity={getZoneBarFillOpacity(series.dataKey)}
                            stroke={hoveredZonePlayerKey === series.dataKey ? '#ffffff' : 'transparent'}
                            strokeWidth={hoveredZonePlayerKey === series.dataKey ? 1.2 : 0}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </>
          )}

          <h2>Player Stats Table (Round {selectedRound})</h2>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                {selectedRound === 2 && !selectedTeam && <th>Team</th>}
                <th>Total Shots</th>
                <th>Shots Made</th>
                <th>Accuracy</th>
                  <th style={selectedRound === 1 ? { color: '#f59e0b' } : undefined}>Total Points</th>
                {Array.from({length: 6}, (_, i) => <th key={i+1}>Zone {i+1} Made/Total (Acc%)</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredPlayerStats.map(player => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  {selectedRound === 2 && !selectedTeam && <td>{player.team}</td>}
                  <td>{player.totalShots}</td>
                  <td>{player.totalMade}</td>
                  <td>{player.accuracy}%</td>
                    <td>
                      {selectedRound === 1 ? (
                        <span
                          style={{
                            display: 'inline-block',
                            minWidth: '56px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '1rem',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '999px',
                            padding: '0.2rem 0.65rem'
                          }}
                        >
                          {player.totalPoints}
                        </span>
                      ) : (
                        player.totalPoints
                      )}
                    </td>
                  {Array.from({length: 6}, (_, i) => {
                    const z = i + 1
                    const stat = player.zoneStats[z]
                    return (
                      <td key={z} style={getAccuracyCellStyle(stat)}>
                        {stat.made}/{stat.total} ({stat.accuracy}%)
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {selectedRound === 2 && (
            <>
              <h2>{selectedTeam ? selectedTeam.name : 'Team'} Stats Table (Round {selectedRound})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Total Shots</th>
                    <th>Shots Made</th>
                    <th>Accuracy</th>
                    <th>Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {finalTeamStats.map(team => (
                    <tr key={team.id}>
                      <td>{team.name}</td>
                      <td>{team.totalShots}</td>
                      <td>{team.totalMade}</td>
                      <td>{team.accuracy}%</td>
                      <td>{team.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {filteredPlayerStats.length > 0 && (
            <>
          {selectedRound === 2 && finalTeamStats.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
              <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Team Points</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={teamPointsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey="name" stroke="#ffffff" />
                  <YAxis stroke="#ffffff" allowDecimals={false} />
                  <Tooltip contentStyle={{backgroundColor: '#1a2f4f', border: '1px solid #4fa3ff'}} />
                  <Legend />
                  <Bar dataKey="points" fill="#60a5fa" name="Team Points" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* 2. Pie Chart - Point Contributions */}
            <div style={{ padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
              <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Points Per Player</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pointContributions}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={95}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pointContributions.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#1a2f4f', border: '1px solid #4fa3ff'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Pie Chart - Zone Shot Distribution */}
            <div style={{ padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '12px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
              <h2 style={{ marginTop: 0, color: '#4fa3ff' }}>Shots Per Zone</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={zoneShotContributions}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={95}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill={ZONE_COLORS[1]} />
                    <Cell fill={ZONE_COLORS[2]} />
                    <Cell fill={ZONE_COLORS[3]} />
                    <Cell fill={ZONE_COLORS[4]} />
                    <Cell fill={ZONE_COLORS[5]} />
                    <Cell fill={ZONE_COLORS[6]} />
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#1a2f4f', border: '1px solid #4fa3ff'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default DataView