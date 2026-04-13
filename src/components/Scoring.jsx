import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { getZoneColor } from '../models/heatmapModel'
import HeatmapCourt from './HeatmapCourt'

function Scoring() {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [currentRound, setCurrentRound] = useState(1)
  const [warningMessage, setWarningMessage] = useState('')
  const [zoneStats, setZoneStats] = useState({})
  const [celebratingZones, setCelebratingZones] = useState({})
  const [particles, setParticles] = useState([])
  const [shots, setShots] = useState([])
  const recordShotRef = useRef(null)

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

  const handleRoundSelect = (round) => {
    setCurrentRound(round)
    setZoneStats({})
    setShots([])
  }

  const fetchZoneStats = useCallback(async (player) => {
    if (!player) return
    if (supabase) {
      const { data, error } = await supabase
        .from('shots')
        .select('*')
        .eq('player_id', player.id)
        .eq('round', currentRound)
        .order('created_at', { ascending: false })
      if (error) console.error(error)
      else {
        setShots(data || [])
        const stats = {}
        data.forEach(shot => {
          if (!stats[shot.zone]) stats[shot.zone] = { made: 0, total: 0 }
          stats[shot.zone].total++
          if (shot.made) stats[shot.zone].made++
        })
        setZoneStats(stats)
      }
    } else {
      const allShots = JSON.parse(localStorage.getItem('shots') || '[]')
        .filter(shot => shot.player_id === player.id && (shot.round || 1) === currentRound)
        .sort((a, b) => b.id - a.id) // Sort by id descending (most recent first)
      setShots(allShots)
      const stats = {}
      allShots.forEach(shot => {
        if (!stats[shot.zone]) stats[shot.zone] = { made: 0, total: 0 }
        stats[shot.zone].total++
        if (shot.made) stats[shot.zone].made++
      })
      setZoneStats(stats)
    }
  }, [currentRound])

  useEffect(() => {
    if (selectedPlayer) {
      fetchZoneStats(selectedPlayer)
    }
  }, [selectedPlayer, currentRound, fetchZoneStats])

  const recordShot = async (zone, made, event) => {
    if (!selectedPlayer || recordShotRef.current) return
    
    recordShotRef.current = true

    if (currentRound === 2 && shots.length >= 16) {
      setWarningMessage(`Warning: ${selectedPlayer.name} is above 16 shots in Round 2.`)
      setTimeout(() => setWarningMessage(''), 2200)
    }
    
    const points = zone === 1 ? 1 : zone <= 3 ? 2 : 3
    const pointChange = made ? points : 0
    
    // Trigger celebration animation if made
    if (event) {
      const rect = event.target.getBoundingClientRect()
      const buttonCenterX = rect.left + rect.width / 2
      const buttonCenterY = rect.top + rect.height / 2
      
      const newParticles = [{
        id: Date.now(),
        x: buttonCenterX,
        y: buttonCenterY,
        emoji: made ? '🏀' : '🧱'
      }]
      
      setParticles(prev => [...prev, ...newParticles])
      setCelebratingZones(prev => ({ ...prev, [zone]: true }))
      
      setTimeout(() => {
        setCelebratingZones(prev => {
          const newState = { ...prev }
          delete newState[zone]
          return newState
        })
        setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)))
      }, 1000)
    }
    
    try {
      if (supabase) {
        const { error } = await supabase.from('shots').insert([{
          player_id: selectedPlayer.id,
          round: currentRound,
          zone,
          made,
          points: pointChange
        }])
        if (error) console.error(error)
        else {
          await fetchZoneStats(selectedPlayer)
        }
      } else {
        const newShot = {
          id: Date.now(),
          player_id: selectedPlayer.id,
          round: currentRound,
          zone,
          made,
          points: pointChange
        }
        const shots = JSON.parse(localStorage.getItem('shots') || '[]')
        shots.push(newShot)
        localStorage.setItem('shots', JSON.stringify(shots))
        await fetchZoneStats(selectedPlayer)
      }
    } finally {
      // Reset debounce after 500ms to prevent quick repeated clicks
      setTimeout(() => {
        recordShotRef.current = false
      }, 500)
    }
  }

  const undoShot = async () => {
    if (!selectedPlayer || shots.length === 0) return

    const lastShot = shots[0]

    try {
      if (supabase) {
        const { error } = await supabase.from('shots').delete().eq('id', lastShot.id)
        if (error) console.error(error)
        else {
          await fetchZoneStats(selectedPlayer)
        }
      } else {
        const allShots = JSON.parse(localStorage.getItem('shots') || '[]')
        const filteredShots = allShots.filter(shot => shot.id !== lastShot.id)
        localStorage.setItem('shots', JSON.stringify(filteredShots))
        await fetchZoneStats(selectedPlayer)
      }
    } catch (error) {
      console.error('Error undoing shot:', error)
    }
  }

  const zones = [1, 2, 3, 4, 5, 6]

  const animationStyles = `
    @keyframes celebrate {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(79, 163, 255, 0.7);
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
        box-shadow: 0 0 0 20px rgba(79, 163, 255, 0);
      }
    }

    @keyframes confetti {
      0% {
        transform: translate(-50%, -50%) scale(1) rotate(0deg);
        opacity: 1;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.3);
      }
      100% {
        transform: translate(-50%, -50%) translateY(-100px) scale(0.8) rotate(720deg);
        opacity: 0;
      }
    }

    .celebrating {
      animation: celebrate 0.6s ease-out;
    }

    .confetti-particle {
      position: fixed;
      pointer-events: none;
      font-size: 80px;
      animation: confetti 1s ease-out forwards;
      z-index: 9999;
      line-height: 1;
    }

    .undo-button {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      padding: 0.75rem 1rem;
      font-size: 13px;
      font-weight: bold;
      border: none;
      background: linear-gradient(135deg, #ff9500 0%, #ffb143 100%);
      color: white;
      border-radius: 50px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(255, 149, 0, 0.4);
      transition: all 0.3s ease;
      z-index: 1000;
    }

    .undo-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(255, 149, 0, 0.6);
    }

    .undo-button:active {
      transform: translateY(0);
    }

    .warning-popup {
      position: fixed;
      top: 1rem;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 10px;
      padding: 0.7rem 1rem;
      font-weight: 700;
      z-index: 2000;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
    }
  `

  return (
    <div style={{ minHeight: '100vh', padding: '1rem 0.75rem', backgroundColor: 'transparent' }}>
      <style>{animationStyles}</style>
      
      {/* Confetti Particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
          }}
        >
          {particle.emoji}
        </div>
      ))}

      {/* Floating Undo Button */}
      {selectedPlayer && shots.length > 0 && (
        <button
          onClick={undoShot}
          className="undo-button"
          title="Undo last shot in selected round"
        >
          ↶ Undo Shot
        </button>
      )}

      {warningMessage && <div className="warning-popup">{warningMessage}</div>}

      <h1>Scoring</h1>
      {!supabase && <p style={{color: 'red'}}>Using local storage - data will not persist after refresh</p>}

      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
        <h2 style={{marginTop: 0, color: '#ffffff'}}>Select Round</h2>
        <p style={{marginTop: 0, color: 'rgba(255, 255, 255, 0.8)'}}>
          Round 1: individual scoring leaderboard by player points. Round 2: group scoring with a warning if a player exceeds 16 shots.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: '0.6rem', maxWidth: '340px' }}>
          {[1, 2].map(round => (
            <button
              key={round}
              onClick={() => handleRoundSelect(round)}
              style={{
                padding: '0.55rem 0.8rem',
                fontSize: '14px',
                fontWeight: 'bold',
                border: '2px solid',
                borderColor: currentRound === round ? '#4fa3ff' : 'rgba(79, 163, 255, 0.3)',
                backgroundColor: currentRound === round ? 'rgba(79, 163, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
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
      
      <div style={{ display: 'grid', gridTemplateColumns: selectedTeam ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Step 1: Select Team */}
        <div style={{ padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
          <h2 style={{marginTop: 0, color: '#ffffff'}}>Step 1: Select Team (Round {currentRound})</h2>
          {currentRound === 1 && (
            <p style={{marginTop: 0, color: 'rgba(255, 255, 255, 0.8)'}}>
              Teams are used for selection only in round 1. Leaderboard ranking is individual.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem' }}>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => handleTeamSelect(team.id)}
                style={{
                  padding: '0.65rem 0.7rem',
                  fontSize: '14px',
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
          <div style={{ padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
            <h2 style={{marginTop: 0, color: '#ffffff'}}>Step 2: Select Player</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem' }}>
              {selectedTeam.players.map(player => (
                <button
                  key={player.id}
                  onClick={() => handlePlayerSelect(player.id)}
                  style={{
                    padding: '0.65rem 0.7rem',
                    fontSize: '14px',
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
      </div>

      <HeatmapCourt
        zoneStats={zoneStats}
        title={selectedPlayer ? `${selectedPlayer.name} Accuracy Heatmap (Round ${currentRound})` : `Accuracy Heatmap (Round ${currentRound})`}
      />

      {/* Step 3: Record Shots */}
      {selectedPlayer && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(79, 163, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(79, 163, 255, 0.2)' }}>
          <h2 style={{marginTop: 0, color: '#ffffff'}}>Step 3: Record Shots for {selectedPlayer.name} (Round {currentRound})</h2>
          <p style={{marginTop: 0, color: 'rgba(255, 255, 255, 0.8)'}}>
            Shots recorded this round for {selectedPlayer.name}: {shots.length}
          </p>
          
          <h3 style={{marginBottom: '0.8rem', marginTop: '1rem', color: '#4fa3ff'}}>Click to record a shot:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.6rem' }}>
            {zones.map(zone => {
              const stat = zoneStats[zone]
              const made = stat?.made || 0
              const total = stat?.total || 0
              
              return (
                <div key={zone} style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(79, 163, 255, 0.2)',
                  textAlign: 'center'
                }}>
                  <div style={{fontSize: '13px', fontWeight: 'bold', marginBottom: '0.35rem', color: '#4fa3ff'}}>Zone {zone}</div>
                  <div style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '0.45rem', color: '#ffffff'}}>
                    {made}/{total}
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem'}}>
                    {/* Make Button - Checkmark */}
                    <button
                      onClick={(e) => recordShot(zone, true, e)}
                      className={celebratingZones[zone] ? 'celebrating' : ''}
                      style={{
                        padding: '0.6rem 0.25rem',
                        fontSize: '24px',
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
                        minHeight: '54px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}
                      onMouseOver={(e) => {
                        if (!celebratingZones[zone]) {
                          e.target.style.transform = 'scale(1.08)'
                          e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!celebratingZones[zone]) {
                          e.target.style.transform = 'scale(1)'
                          e.target.style.boxShadow = 'none'
                        }
                      }}
                      title="Make"
                    >
                      ✓
                    </button>

                    {/* Miss Button - X */}
                    <button
                      onClick={(e) => recordShot(zone, false, e)}
                      style={{
                        padding: '0.6rem 0.25rem',
                        fontSize: '24px',
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
                        minHeight: '54px',
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