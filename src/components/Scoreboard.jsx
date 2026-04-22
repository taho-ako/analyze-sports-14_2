import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Scoreboard({ canRestart = false, onRestartGame, highlightTeamId = null }) {
  const [teamResults, setTeamResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      if (supabase) {
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')

        if (teamsError) {
          console.error('Error loading teams for scoreboard:', teamsError)
          setLoading(false)
          return
        }

        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id, name, team_id, shots(round, points)')

        if (playersError) {
          console.error('Error loading players for scoreboard:', playersError)
          setLoading(false)
          return
        }

        const playersByTeam = new Map()
        ;(playersData || []).forEach(player => {
          const existing = playersByTeam.get(player.team_id) || []
          existing.push(player)
          playersByTeam.set(player.team_id, existing)
        })

        const results = (teamsData || []).map(team => {
          const teamPlayers = playersByTeam.get(team.id) || []
          const totalPoints = teamPlayers.reduce((sum, player) => {
            const roundTwoPoints = (player.shots || [])
              .filter(shot => Number(shot.round || 1) === 2)
              .reduce((shotSum, shot) => shotSum + Number(shot.points || 0), 0)

            return sum + roundTwoPoints
          }, 0)

          return {
            id: team.id,
            name: team.name,
            totalPoints
          }
        })

        setTeamResults(results.sort((left, right) => right.totalPoints - left.totalPoints))
        setLoading(false)
        return
      }

      const localTeams = JSON.parse(localStorage.getItem('teams') || '[]')
      const localShots = JSON.parse(localStorage.getItem('shots') || '[]')

      const results = localTeams.map(team => {
        const playerIds = (team.players || []).map(player => String(player.id))
        const totalPoints = localShots
          .filter(shot => Number(shot.round || 1) === 2 && playerIds.includes(String(shot.player_id)))
          .reduce((sum, shot) => sum + Number(shot.points || 0), 0)

        return {
          id: team.id,
          name: team.name,
          totalPoints
        }
      })

      setTeamResults(results.sort((left, right) => right.totalPoints - left.totalPoints))
      setLoading(false)
    }

    fetchResults()
  }, [])

  if (loading) {
    return <div className="loading">Building final scoreboard...</div>
  }

  const winner = teamResults[0]

  return (
    <div style={{ padding: '1rem', minHeight: '70vh' }}>
      <h1 style={{ marginBottom: '0.3rem' }}>Final Scoreboard</h1>
      <p style={{ color: 'rgba(255, 255, 255, 0.82)', marginTop: 0 }}>
        Round 2 team points determine the winner.
      </p>

      {winner && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid rgba(79, 163, 255, 0.4)',
          backgroundColor: 'rgba(79, 163, 255, 0.12)'
        }}>
          <p style={{ margin: 0, color: '#93c5fd', fontWeight: 700 }}>Winner</p>
          <h2 style={{ margin: '0.25rem 0 0', color: '#ffffff' }}>{winner.name}</h2>
          <p style={{ margin: '0.2rem 0 0', color: '#ffffff', fontWeight: 700 }}>{winner.totalPoints} pts</p>
        </div>
      )}

      <div style={{
        borderRadius: '12px',
        border: '1px solid rgba(79, 163, 255, 0.25)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
      }}>
        {teamResults.length === 0 ? (
          <p style={{ margin: 0, padding: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>No team results available.</p>
        ) : (
          teamResults.map((team, index) => {
            const isHighlightedTeam = String(highlightTeamId) === String(team.id)

            return (
              <div
                key={team.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr auto',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.8rem 1rem',
                  borderBottom: index === teamResults.length - 1 ? 'none' : '1px solid rgba(79, 163, 255, 0.2)',
                  backgroundColor: isHighlightedTeam
                    ? 'rgba(34, 197, 94, 0.24)'
                    : (index === 0 ? 'rgba(37, 99, 235, 0.22)' : 'transparent'),
                  outline: isHighlightedTeam ? '2px solid rgba(34, 197, 94, 0.75)' : 'none',
                  outlineOffset: isHighlightedTeam ? '-2px' : '0'
                }}
              >
                <span style={{ color: '#93c5fd', fontWeight: 800 }}>#{index + 1}</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>
                  {team.name}
                  {isHighlightedTeam && (
                    <span style={{ marginLeft: '0.4rem', color: '#bbf7d0', fontWeight: 800 }}>
                      (Your Team)
                    </span>
                  )}
                </span>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>{team.totalPoints} pts</span>
              </div>
            )
          })
        )}
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
        <Link to="/data" style={{
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          border: '1px solid rgba(79, 163, 255, 0.6)',
          backgroundColor: 'rgba(79, 163, 255, 0.18)',
          color: '#ffffff',
          textDecoration: 'none',
          fontWeight: 700
        }}>
          Open Data View
        </Link>
        {canRestart && (
          <button
            onClick={onRestartGame}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(34, 197, 94, 0.7)',
              backgroundColor: 'rgba(34, 197, 94, 0.2)',
              color: '#dcfce7',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Restart Game
          </button>
        )}
      </div>
    </div>
  )
}

export default Scoreboard
