import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function EnterCodePage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onSubmit = (e) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Please enter a code')
      return
    }

    // No validation yet. We only require a non-empty code.
    setError('')
    navigate('/lobby', { state: { code: trimmed } })
  }

  return (
    <div className="enter-code-page">
      <h1>Hooplytics</h1>
      <p className="enter-code-subtitle">Enter your lobby code</p>

      <form className="enter-code-form" onSubmit={onSubmit}>
        <input
          className="enter-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          aria-label="Lobby code"
        />
        <button className="enter-code-button" type="submit">
          Enter
        </button>
      </form>

      {error ? <p className="enter-code-error">{error}</p> : null}
    </div>
  )
}

export default EnterCodePage

