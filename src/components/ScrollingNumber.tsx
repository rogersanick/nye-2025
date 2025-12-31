import { useEffect, useMemo, useRef, useState } from 'react'

function clampNonNegativeInt(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

    const update = () => setReduced(Boolean(mq.matches))
    update()

    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}

function computeForwardPositions({
  prevPositionsFromRight,
  targetDigitsFromRight,
  extraTurnsFromRight,
}: {
  prevPositionsFromRight: number[]
  targetDigitsFromRight: number[]
  extraTurnsFromRight: number[]
}) {
  const next: number[] = []
  for (let i = 0; i < targetDigitsFromRight.length; i++) {
    const prevPos = prevPositionsFromRight[i] ?? 0
    const prevDigit = ((prevPos % 10) + 10) % 10
    const targetDigit = targetDigitsFromRight[i] ?? 0
    const deltaForward = (targetDigit - prevDigit + 10) % 10
    const extraTurns = extraTurnsFromRight[i] ?? 0
    next[i] = prevPos + extraTurns * 10 + deltaForward
  }
  return next
}

export default function ScrollingNumber({
  value,
  className,
  digitClassName,
  durationMs = 900,
  startDelayMs = 250,
}: {
  value: number
  className?: string
  digitClassName?: string
  durationMs?: number
  startDelayMs?: number
}) {
  const reducedMotion = usePrefersReducedMotion()
  const safeValue = clampNonNegativeInt(value)
  const formatted = useMemo(() => new Intl.NumberFormat('en-US').format(safeValue), [safeValue])
  const digitsOnly = useMemo(() => String(safeValue), [safeValue])
  const digitsFromRight = useMemo(
    () => digitsOnly.split('').reverse().map((c) => Number(c)),
    [digitsOnly],
  )

  const [positionsFromRight, setPositionsFromRight] = useState<number[]>([])
  const [suppressTransition, setSuppressTransition] = useState(false)
  const firstRevealDoneRef = useRef(false)
  const timersRef = useRef<{ t?: number; raf?: number }>({})

  const ROW_COUNT = 200
  const NORMALIZE_AT = 160
  const NORMALIZE_BY = 100 // must be a multiple of 10 so the visible digit doesn't change

  useEffect(() => {
    // Clean up any pending animations between value changes.
    if (timersRef.current.t) window.clearTimeout(timersRef.current.t)
    if (timersRef.current.raf) window.cancelAnimationFrame(timersRef.current.raf)
    timersRef.current = {}

    if (reducedMotion) {
      setPositionsFromRight(digitsFromRight)
      firstRevealDoneRef.current = true
      return
    }

    const newLen = digitsFromRight.length

    // First render: start on random digits, then roll into place.
    if (!firstRevealDoneRef.current) {
      const start = new Array(newLen)
        .fill(0)
        .map(() => Math.floor(Math.random() * 10))

      setPositionsFromRight(start)

      timersRef.current.t = window.setTimeout(() => {
        timersRef.current.raf = window.requestAnimationFrame(() => {
          const extraTurns = start.map(() => 1 + Math.floor(Math.random() * 2))
          setPositionsFromRight(computeForwardPositions({ prevPositionsFromRight: start, targetDigitsFromRight: digitsFromRight, extraTurnsFromRight: extraTurns }))
          firstRevealDoneRef.current = true
        })
      }, startDelayMs)

      return
    }

    setPositionsFromRight((prev) => {
      // If the number grew in digits (e.g. 99 -> 100), add new columns at random,
      // then roll them in on the next tick.
      if (prev.length < newLen) {
        const start = [...prev]
        while (start.length < newLen) start.push(Math.floor(Math.random() * 10))

        timersRef.current.raf = window.requestAnimationFrame(() => {
          const extraTurns = start.map((_, i) => (i >= prev.length ? 1 + Math.floor(Math.random() * 2) : 0))
          setPositionsFromRight(
            computeForwardPositions({
              prevPositionsFromRight: start,
              targetDigitsFromRight: digitsFromRight,
              extraTurnsFromRight: extraTurns,
            }),
          )
        })

        return start
      }

      // Normal update: roll forward to the next digits.
      return computeForwardPositions({
        prevPositionsFromRight: prev.slice(0, newLen),
        targetDigitsFromRight: digitsFromRight,
        extraTurnsFromRight: new Array(newLen).fill(0),
      })
    })

    return () => {
      if (timersRef.current.t) window.clearTimeout(timersRef.current.t)
      if (timersRef.current.raf) window.cancelAnimationFrame(timersRef.current.raf)
    }
  }, [digitsFromRight, reducedMotion, startDelayMs])

  useEffect(() => {
    if (reducedMotion) return
    const maxPos = positionsFromRight.reduce((m, v) => Math.max(m, v), 0)
    if (maxPos < NORMALIZE_AT) return

    setSuppressTransition(true)
    setPositionsFromRight((prev) => prev.map((p) => (p >= NORMALIZE_AT ? p - NORMALIZE_BY : p)))
    const raf = window.requestAnimationFrame(() => setSuppressTransition(false))
    return () => window.cancelAnimationFrame(raf)
  }, [NORMALIZE_AT, NORMALIZE_BY, positionsFromRight, reducedMotion])

  const digitsLen = digitsOnly.length
  let digitIndexFromLeft = -1

  return (
    <span
      className={[
        'inline-flex items-baseline tabular-nums',
        reducedMotion ? '' : 'will-change-transform',
        className ?? '',
      ].join(' ')}
      aria-label={formatted}
    >
      <span className="sr-only">{formatted}</span>
      {formatted.split('').map((ch, idx) => {
        const isDigit = ch >= '0' && ch <= '9'
        if (!isDigit) {
          return (
            <span key={`sep-${idx}`} aria-hidden className={digitClassName}>
              {ch}
            </span>
          )
        }

        digitIndexFromLeft += 1
        const iFromRight = digitsLen - 1 - digitIndexFromLeft
        const pos = positionsFromRight[iFromRight] ?? Number(ch)

        // Each row is 1em tall, so we translate by -pos * 1em.
        return (
          <span
            key={`d-${idx}`}
            aria-hidden
            className={[
              'inline-block overflow-hidden align-baseline',
              // width tuned for tabular-nums digits
              'w-[0.75ch] h-[1em] leading-none',
              digitClassName ?? '',
            ].join(' ')}
          >
            <span
              className="flex flex-col leading-none"
              style={{
                transform: `translateY(${-pos}em)`,
                transitionProperty: reducedMotion || suppressTransition ? 'none' : 'transform',
                transitionDuration: suppressTransition ? '0ms' : `${durationMs}ms`,
                transitionTimingFunction: 'cubic-bezier(0.2, 0.9, 0.15, 1)',
              }}
            >
              {Array.from({ length: ROW_COUNT }).map((_, j) => (
                <span key={j} className="h-[1em] leading-none">
                  {j % 10}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}

