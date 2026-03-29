import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function Scoring() {
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [zoneStats, setZoneStats] = useState({})

  const fetchTeams = useCallback(async () => {
    if (supabase) {
      const { data, error } = await supabase.from('teams').select('*, players(*)')
      if (error) console.error(error)
      else setTeams(data)
    } else {
      const localTeams = JSON.parse(localStorage.getItem('teams') || '[]')
      setTeams(localTeams)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const handleTeamSelect = (teamId) => {
    const team = teams.find(t => t.id == teamId)
    setSelectedTeam(team)
    setSelectedPlayer(null)
    setZoneStats({})
  }

  const handlePlayerSelect = (playerId) => {
    const player = selectedTeam?.players.find(p => p.id == playerId)
    setSelectedPlayer(player)
    fetchZoneStats(player)
  }

  const fetchZoneStats = useCallback(async (player) => {
    if (!player) return
    if (supabase) {
      const { data, error } = await supabase
        .from('shots')
        .select('*')
        .eq('player_id', player.id)
      if (error) console.error(error)
      else {
        const stats = {}
        data.forEach(shot => {
          if (!stats[shot.zone]) stats[shot.zone] = { made: 0, total: 0 }
          stats[shot.zone].total++
          if (shot.made) stats[shot.zone].made++
        })
        setZoneStats(stats)
      }
    } else {
      const shots = JSON.parse(localStorage.getItem('shots') || '[]').filter(shot => shot.player_id === player.id)
      const stats = {}
      shots.forEach(shot => {
        if (!stats[shot.zone]) stats[shot.zone] = { made: 0, total: 0 }
        stats[shot.zone].total++
        if (shot.made) stats[shot.zone].made++
      })
      setZoneStats(stats)
    }
  }, [])

  const recordShot = async (zone, made) => {
    if (!selectedPlayer) return
    const points = zone === 1 ? 1 : zone <= 3 ? 2 : 3
    const pointChange = made ? points : 0
    if (supabase) {
      const { error } = await supabase.from('shots').insert([{
        player_id: selectedPlayer.id,
        zone,
        made,
        points: pointChange
      }])
      if (error) console.error(error)
      else {
        fetchZoneStats(selectedPlayer)
      }
    } else {
      const newShot = {
        id: Date.now(),
        player_id: selectedPlayer.id,
        zone,
        made,
        points: pointChange
      }
      const shots = JSON.parse(localStorage.getItem('shots') || '[]')
      shots.push(newShot)
      localStorage.setItem('shots', JSON.stringify(shots))
      fetchZoneStats(selectedPlayer)
    }
  }

  const getZoneColor = (zone) => {
    const stat = zoneStats[zone]
    if (!stat || stat.total === 0) {
      // Gray if no shots
      return '#d1d5db'
    }
    const accuracy = stat.made / stat.total
    
    // Interpolate color: Red (0%) -> Yellow (50%) -> Green (100%)
    let r, g, b
    
    if (accuracy < 0.5) {
      // Red to Yellow: interpolate between red (#ef4444) and yellow (#fbbf24)
      const ratio = accuracy / 0.5 // 0 to 1
      r = Math.round(239 - (239 - 251) * ratio) // 239 -> 251
      g = Math.round(68 + (191 - 68) * ratio)   // 68 -> 191
      b = Math.round(68 + (36 - 68) * ratio)    // 68 -> 36
    } else {
      // Yellow to Green: interpolate between yellow (#fbbf24) and green (#22c55e)
      const ratio = (accuracy - 0.5) / 0.5 // 0 to 1
      r = Math.round(251 - (251 - 34) * ratio)  // 251 -> 34
      g = Math.round(191 + (197 - 191) * ratio) // 191 -> 197
      b = Math.round(36 - 36 * ratio)           // 36 -> 0
    }
    
    return `rgb(${r}, ${g}, ${b})`
  }

  const zones = [1, 2, 3, 4, 5, 6]

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', backgroundColor: 'transparent' }}>
      <h1>Scoring</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}
      
      {/* Step 1: Select Team */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <h2 style={{marginTop: 0}}>Step 1: Select Team</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => handleTeamSelect(team.id)}
              style={{
                padding: '1rem',
                fontSize: '16px',
                fontWeight: 'bold',
                border: '2px solid',
                borderColor: selectedTeam?.id === team.id ? '#3b82f6' : '#d1d5db',
                backgroundColor: selectedTeam?.id === team.id ? '#dbeafe' : 'white',
                color: selectedTeam?.id === team.id ? '#1e40af' : '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Select Player */}
      {selectedTeam && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <h2 style={{marginTop: 0}}>Step 2: Select Player</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {selectedTeam.players.map(player => (
              <button
                key={player.id}
                onClick={() => handlePlayerSelect(player.id)}
                style={{
                  padding: '1rem',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  border: '2px solid',
                  borderColor: selectedPlayer?.id === player.id ? '#ec4899' : '#d1d5db',
                  backgroundColor: selectedPlayer?.id === player.id ? '#fce7f3' : 'white',
                  color: selectedPlayer?.id === player.id ? '#be185d' : '#374151',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Record Shots */}
      {selectedPlayer && (
        <div style={{ padding: '1.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <h2 style={{marginTop: 0}}>Step 3: Record Shots for {selectedPlayer.name}</h2>
          
          <h3 style={{marginBottom: '1.5rem', marginTop: '2rem'}}>Click to record a shot:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            {zones.map(zone => {
              const stat = zoneStats[zone]
              const made = stat?.made || 0
              const total = stat?.total || 0
              
              return (
                <div key={zone} style={{
                  backgroundColor: 'white',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  textAlign: 'center'
                }}>
                  <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '0.5rem', color: '#6b7280'}}>Zone {zone}</div>
                  <div style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '0.75rem', color: '#374151'}}>
                    {made}/{total}
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                    {/* Make Button - Checkmark */}
                    <button
                      onClick={() => recordShot(zone, true)}
                      style={{
                        padding: '1rem 0.5rem',
                        fontSize: '32px',
                        fontWeight: 'bold',
                        border: 'none',
                        backgroundColor: getZoneColor(zone),
                        color: 'white',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '70px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = 'scale(1.08)'
                        e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = 'scale(1)'
                        e.target.style.boxShadow = 'none'
                      }}
                      title="Make"
                    >
                      ✓
                    </button>

                    {/* Miss Button - X */}
                    <button
                      onClick={() => recordShot(zone, false)}
                      style={{
                        padding: '1rem 0.5rem',
                        fontSize: '32px',
                        fontWeight: 'bold',
                        border: 'none',
                        backgroundColor: getZoneColor(zone),
                        color: 'white',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '70px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = 'scale(1.08)'
                        e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = 'scale(1)'
                        e.target.style.boxShadow = 'none'
                      }}
                      title="Miss"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Scoring