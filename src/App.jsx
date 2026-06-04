import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ─── Data ─────────────────────────────────────────────────────────────────────

const ALL_COLORS = ['white', 'red', 'blue', 'yellow', 'green', 'brown', 'black', 'purple', 'orange', 'gray']

const HEBREW = {
  white:  'לבן',
  red:    'אדום',
  blue:   'כחול',
  yellow: 'צהוב',
  green:  'ירוק',
  brown:  'חום',
  black:  'שחור',
  purple: 'סגול',
  orange: 'כתום',
  gray:   'אפור',
}

const HEX = {
  white:  '#f5f5f5',
  red:    '#e53935',
  blue:   '#1e88e5',
  yellow: '#fdd835',
  green:  '#43a047',
  brown:  '#795548',
  black:  '#37474f',
  purple: '#8e24aa',
  orange: '#fb8c00',
  gray:   '#9e9e9e',
}

// Colors that need dark text (light backgrounds)
const DARK_TEXT = new Set(['white', 'yellow', 'gray'])

// Fixed 2×2 position order: top-left, top-right, bottom-left, bottom-right
const POSITIONS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']

// Q=top-left  W=top-right  A=bottom-left  S=bottom-right
// Arduino Leonardo will emulate these same keys.
const KEY_MAP = { q: 'topLeft', w: 'topRight', a: 'bottomLeft', s: 'bottomRight' }

const WIN_LEVEL = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Randomly assign 4 unique colors (from ALL_COLORS) to the 4 positions. */
function pickColorMap() {
  const shuffled = [...ALL_COLORS].sort(() => Math.random() - 0.5)
  const four = shuffled.slice(0, 4)
  return { topLeft: four[0], topRight: four[1], bottomLeft: four[2], bottomRight: four[3] }
}

/** Pick a random element from an array. */
const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)]

/** Say text in Hebrew via the Web Speech API. */
function speak(text) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'he-IL'
  u.rate = 0.85
  speechSynthesis.speak(u)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // 'home' | 'game' | 'gameover' | 'win'
  const [screen, setScreen] = useState('home')

  // Maps position → color for the current game (fixed per game, randomised on start)
  const [colorMap, setColorMap] = useState({})

  // The full sequence so far (grows by one each level)
  const [sequence, setSequence] = useState([])

  // Current level (1–10); sequence.length always equals level
  const [level, setLevel] = useState(1)

  // 'showing' while playing the sequence animation, 'input' while waiting for the user
  const [phase, setPhase] = useState('showing')

  // Position currently highlighted during sequence playback
  const [activePos, setActivePos] = useState(null)

  // Position briefly lit up after a user key-press
  const [pressedPos, setPressedPos] = useState(null)

  // How many correct inputs the user has given for the current sequence
  const [inputStep, setInputStep] = useState(0)

  // ── Start / Restart ─────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const cm = pickColorMap()
    const firstColor = randomFrom(Object.values(cm))
    setColorMap(cm)
    setSequence([firstColor])
    setLevel(1)
    setPhase('showing')
    setInputStep(0)
    setActivePos(null)
    setPressedPos(null)
    setScreen('game')
  }, [])

  // ── Sequence animation ───────────────────────────────────────────────────────
  // Re-runs whenever the sequence grows (new level) or a new game starts.

  useEffect(() => {
    if (screen !== 'game') return
    let cancelled = false

    async function playSequence() {
      setPhase('showing')
      setInputStep(0)
      await sleep(800)

      for (const color of sequence) {
        if (cancelled) return
        const pos = POSITIONS.find(p => colorMap[p] === color)
        setActivePos(pos)
        speak(HEBREW[color])
        await sleep(1000)
        if (cancelled) return
        setActivePos(null)
        await sleep(400)
      }

      if (!cancelled) {
        setPhase('input')
        setInputStep(0)
      }
    }

    playSequence()
    return () => { cancelled = true }
  }, [sequence, colorMap, screen])

  // ── Keyboard input ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'game' || phase !== 'input') return

    function handleKey(e) {
      const pos = KEY_MAP[e.key.toLowerCase()]
      if (!pos) return

      // Brief visual flash on the pressed position
      setPressedPos(pos)
      setTimeout(() => setPressedPos(null), 220)

      const pressedColor  = colorMap[pos]
      const expectedColor = sequence[inputStep]

      if (pressedColor !== expectedColor) {
        setScreen('gameover')
        return
      }

      const nextStep = inputStep + 1

      // Still more inputs needed for this level
      if (nextStep < sequence.length) {
        setInputStep(nextStep)
        return
      }

      // Entire sequence correct — advance or win
      if (level >= WIN_LEVEL) {
        setScreen('win')
      } else {
        const nextColor = randomFrom(Object.values(colorMap))
        setLevel(l => l + 1)
        setSequence(prev => [...prev, nextColor])
        // Changing `sequence` triggers the playSequence effect above
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [screen, phase, inputStep, sequence, colorMap, level])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (screen === 'home') {
    return (
      <div className="screen">
        <div className="card">
          <h1>Simon Says</h1>
          <p className="sub">משחק זיכרון צבעים</p>
          <button className="btn-start" onClick={startGame}>התחל משחק</button>
          <div className="key-hint-wrap">
            <div className="key-hint-grid">
              <kbd>Q</kbd><kbd>W</kbd>
              <kbd>A</kbd><kbd>S</kbd>
            </div>
            <p className="key-hint-label">מקשי משחק</p>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'gameover') {
    return (
      <div className="screen">
        <div className="card result gameover">
          <div className="result-icon">💥</div>
          <h2>טעית!</h2>
          <p>הגעת לשלב <strong>{level}</strong></p>
          <button className="btn-start" onClick={startGame}>שחק שוב</button>
        </div>
      </div>
    )
  }

  if (screen === 'win') {
    return (
      <div className="screen">
        <div className="card result win">
          <div className="result-icon">🏆</div>
          <h2>ניצחת!</h2>
          <p>כל הכבוד! השלמת את כל {WIN_LEVEL} השלבים!</p>
          <button className="btn-start" onClick={startGame}>שחק שוב</button>
        </div>
      </div>
    )
  }

  // ── Game screen ──────────────────────────────────────────────────────────────
  return (
    <div className="screen game">
      <header className="hud">
        <span className="hud-level">שלב {level} / {WIN_LEVEL}</span>
        <span className="hud-status">
          {phase === 'showing'
            ? '👀 זכור את הסדרה...'
            : `${inputStep} / ${sequence.length} ✓`}
        </span>
      </header>

      <div className="grid">
        {POSITIONS.map(pos => {
          const color     = colorMap[pos]
          const isActive  = activePos  === pos
          const isPressed = pressedPos === pos
          const shadow    = isActive
            ? `0 0 50px ${HEX[color]}, 0 0 100px ${HEX[color]}`
            : isPressed
            ? `0 0 28px ${HEX[color]}`
            : 'none'

          return (
            <div
              key={pos}
              className={`cell${isActive ? ' active' : ''}${isPressed ? ' pressed' : ''}`}
              style={{ backgroundColor: HEX[color], boxShadow: shadow }}
            >
              <span
                className="cell-label"
                style={{ color: DARK_TEXT.has(color) ? '#222' : '#fff' }}
              >
                {HEBREW[color]}
              </span>
            </div>
          )
        })}
      </div>

      <div className="key-guide">
        <div className="key-row"><kbd>Q</kbd><kbd>W</kbd></div>
        <div className="key-row"><kbd>A</kbd><kbd>S</kbd></div>
      </div>
    </div>
  )
}
