import { useEffect, useMemo, useState } from 'react'

type CountdownParts = {
  totalSeconds: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getCountdownParts(msRemaining: number): CountdownParts {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { totalSeconds, days, hours, minutes, seconds }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export default function DramaticCountdown({
  msRemaining,
  isReached,
  deadlineLabel = 'Deadline: 9:00 PM EST',
}: {
  msRemaining: number
  isReached: boolean
  deadlineLabel?: string
}) {
  const parts = useMemo(() => getCountdownParts(msRemaining), [msRemaining])
  const lastHour = parts.totalSeconds <= 60 * 60
  const lastMinute = parts.totalSeconds <= 60
  const lastTen = parts.totalSeconds <= 10

  // Quick "tick" accent on each second change.
  const [tick, setTick] = useState(false)
  useEffect(() => {
    setTick(true)
    const t = window.setTimeout(() => setTick(false), 220)
    return () => window.clearTimeout(t)
  }, [parts.totalSeconds])

  // Starts building pressure in the final 6 hours (0..1).
  const pressure = useMemo(() => {
    // Build "pressure" over the final 24 hours leading into the deadline (0..1).
    // This makes the percentage useful for the whole day-of, not just the last few hours.
    const windowMs = 24 * 60 * 60 * 1000
    const p = 1 - msRemaining / windowMs
    return Math.min(1, Math.max(0, p))
  }, [msRemaining])

  const timeText = isReached
    ? '00:00:00'
    : parts.days > 0
      ? `${parts.days}d ${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`
      : `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`

  return (
    <div
      className={[
        'ny-countdown ny-glass relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur',
        tick ? 'ny-countdown--tick' : '',
        lastHour ? 'ny-countdown--lastHour' : '',
        lastMinute ? 'ny-countdown--lastMinute' : '',
        lastTen ? 'ny-countdown--lastTen' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ny-glow-orbs pointer-events-none absolute inset-0 opacity-35" />
      <div className="ny-countdown-scan pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
            {deadlineLabel}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div
              className="ny-countdown-time font-mono text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl md:text-6xl"
              aria-live="polite"
              aria-label={`Time remaining ${timeText}`}
            >
              {timeText}
            </div>
            {isReached ? (
              <span className="inline-flex items-center rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-100">
                Submissions closed
              </span>
            ) : lastTen ? (
              <span className="inline-flex items-center rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-100">
                Final seconds
              </span>
            ) : lastMinute ? (
              <span className="inline-flex items-center rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                Final minute
              </span>
            ) : lastHour ? (
              <span className="inline-flex items-center rounded-full border border-ice/25 bg-ice/10 px-3 py-1 text-xs font-semibold text-ice">
                Final hour
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-white/65">
            {isReached
              ? 'Time is up. Goals are locked.'
              : 'Submit before it hits zero. When the clock runs out, the form closes.'}
          </p>
        </div>

        <div className="w-full max-w-md">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55">
            <span>Pressure</span>
            <span className="tabular-nums">{Math.round(pressure * 100)}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/10 bg-black/35">
            <div
              className="ny-countdown-pressure h-full rounded-full bg-gradient-to-r from-ice via-gold to-red-400"
              style={{ width: `${Math.max(2, Math.round(pressure * 100))}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/55">
            <span>Calm</span>
            <span>Now</span>
          </div>
        </div>
      </div>
    </div>
  )
}
