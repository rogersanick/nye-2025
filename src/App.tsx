import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Sparkles, Stars } from '@react-three/drei'
import { Vector3 } from 'three'

import ScrollIndicator from './components/ScrollIndicator'
import ExplosionConfetti from './components/confetti'
import { ShaderFireworks } from './components/ShaderFireworks'
import DramaticCountdown from './components/DramaticCountdown'
import StockTickerBanner from './components/StockTickerBanner'
import ScrollingNumber from './components/ScrollingNumber'
import { createClient } from './lib/supabaseClient'

type GoalPublicRow = {
  id: string
  display_name: string
  title: string
  created_at: string
}

type GoalFullRow = GoalPublicRow & { goal_text: string }

type GregUpdateRow = {
  id: string
  title: string
  body: string
  video_path: string
  created_at: string
}

type MaybePostgrestError = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
}

function formatSupabaseDataError(err: MaybePostgrestError | null | undefined) {
  if (!err) return null
  const status = typeof err.status === 'number' ? err.status : undefined
  const code = err.code || ''
  const msg = (err.message || '').toLowerCase()

  // Common case when the app points at the wrong Supabase project (table doesn't exist there).
  const isMissingRelation =
    status === 404 ||
    code === '42P01' ||
    msg.includes('not found') ||
    msg.includes('relation') ||
    msg.includes('does not exist')

  if (isMissingRelation) {
    return [
      'Supabase returned “table not found”.',
      'This usually means your `VITE_SUPABASE_URL` is pointing at a Supabase project where the migration was not run.',
      'Fix: run `supabase/migrations/20251231000100_init.sql` in *that* project (SQL editor), or update your env vars to the correct project.',
    ].join(' ')
  }

  return `Supabase error${status ? ` (${status})` : ''}: ${err.message ?? 'Unknown error'}`
}

function useLocationSnapshot() {
  const [snap, setSnap] = useState(() => ({
    pathname: window.location.pathname || '/',
    hash: window.location.hash || '#',
  }))

  useEffect(() => {
    const update = () =>
      setSnap({
        pathname: window.location.pathname || '/',
        hash: window.location.hash || '#',
      })

    const onHashChange = () => update()
    const onPopState = () => update()

    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onPopState)

    const origPushState = window.history.pushState
    const origReplaceState = window.history.replaceState

    // Ensure SPA navigation (pushState/replaceState) re-renders.
    window.history.pushState = function (...args: Parameters<History['pushState']>) {
      origPushState.apply(window.history, args as any)
      update()
    } as any
    window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
      origReplaceState.apply(window.history, args as any)
      update()
    } as any

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onPopState)
      window.history.pushState = origPushState
      window.history.replaceState = origReplaceState
    }
  }, [])

  return snap
}

function NewYearsBackdrop({ confetti }: { confetti: boolean }) {
  const shaderFireworksRef = useRef<{
    spawn: (
      position: Vector3,
      options?: {
        count?: number
        radius?: number
        size?: number
        duration?: number
        shape?: 'sphere' | 'ring' | 'palm' | 'disc'
        texture?: 'soft' | 'ring' | 'spark' | 'streak'
      },
    ) => void
  } | null>(null)

  const { camera } = useThree()
  const spawnClock = useRef(0)
  const tmp = useMemo(
    () => ({
      ndc: new Vector3(),
      dir: new Vector3(),
      pos: new Vector3(),
    }),
    [],
  )

  useFrame((_, delta) => {
    const shader = shaderFireworksRef.current
    if (!shader) return

    // Spawn fireworks evenly across the viewport (screen-space distribution).
    spawnClock.current += delta
    const cadence = confetti ? 0.8 : 1.25 // less frequent overall
    if (spawnClock.current < cadence) return
    spawnClock.current = 0

    const textures: Array<'soft' | 'spark' | 'streak'> = ['soft', 'spark', 'streak']

    const bursts = Math.random() < 0.25 ? 2 : 1
    for (let i = 0; i < bursts; i++) {
      // Random NDC x/y => uniform over screen.
      const x = Math.random() * 2 - 1
      const y = Math.random() * 2 - 1

      // Create a world direction through that screen point.
      tmp.ndc.set(x, y, 0.0).unproject(camera)
      tmp.dir.copy(tmp.ndc).sub(camera.position).normalize()

      // Place the explosion somewhere in front of camera, deeper into the scene.
      const dist = 10 + Math.random() * 14
      tmp.pos.copy(camera.position).add(tmp.dir.multiplyScalar(dist))

      shader.spawn(tmp.pos, {
        count: Math.round(650 + Math.random() * 1250),
        radius: 0.9 + Math.random() * 1.7,
        size: 0.05 + Math.random() * 0.06,
        duration: 4.2 + Math.random() * 2.4, // slower + longer
        shape: 'sphere',
        texture: textures[Math.floor(Math.random() * textures.length)],
      })
    }
  })

  return (
    <>
      <color attach="background" args={['#060917']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 8, 6]} intensity={1.1} />
      <Environment preset="city" />
      <fog attach="fog" args={['#060917', 8, 20]} />

      <Stars radius={140} depth={55} count={3800} factor={4} fade speed={1} />
      <Sparkles count={260} scale={16} size={2} speed={0.55} opacity={0.75} color="#f7d46a" />

      {/* Shader fireworks (explosions) */}
      <ShaderFireworks ref={shaderFireworksRef as any} />

      <ExplosionConfetti
        isExploding={confetti}
        amount={130}
        rate={6}
        radius={10}
        areaWidth={4}
        areaHeight={1}
        fallingHeight={9}
        fallingSpeed={6}
        colors={[0xf7d46a, 0xffffff, 0x60a5fa, 0xa78bfa]}
        enableShadows={false}
      />
    </>
  )
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getZonedDateParts(date: Date, timeZone: string): DateParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = dtf.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function addDaysToYmd(ymd: Pick<DateParts, 'year' | 'month' | 'day'>, days: number) {
  const base = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day))
  base.setUTCDate(base.getUTCDate() + days)
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const p = getZonedDateParts(date, timeZone)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUTC - date.getTime()
}

function zonedTimeToUtc(parts: DateParts, timeZone: string) {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  )
  const offset1 = getTimeZoneOffsetMs(utcGuess, timeZone)
  const utc = new Date(utcGuess.getTime() - offset1)
  // DST boundary safety: re-check once.
  const offset2 = getTimeZoneOffsetMs(utc, timeZone)
  if (offset2 !== offset1) return new Date(utcGuess.getTime() - offset2)
  return utc
}

function getNextNinePmEasternUtc(now: Date) {
  const tz = 'America/New_York'
  const p = getZonedDateParts(now, tz)
  const isBeforeNinePm = p.hour < 21
  const ymd = addDaysToYmd({ year: p.year, month: p.month, day: p.day }, isBeforeNinePm ? 0 : 1)
  return zonedTimeToUtc({ ...ymd, hour: 21, minute: 0, second: 0 }, tz)
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

function App() {
  const scrollContainerRef = useRef<HTMLDivElement>(null!)
  const supabaseRef = useRef(createClient())
  const loc = useLocationSnapshot()

  const isGregRoute =
    /^\/greg\/?$/i.test(loc.pathname) || (loc.hash || '#').toLowerCase().startsWith('#/greg')

  const [confetti, setConfetti] = useState(false)

  // Guest: submit goal
  const [displayName, setDisplayName] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalText, setGoalText] = useState('')
  const [goalSubmitLoading, setGoalSubmitLoading] = useState(false)
  const [goalSubmitError, setGoalSubmitError] = useState<string | null>(null)
  const [goalSubmitSuccess, setGoalSubmitSuccess] = useState<string | null>(null)

  // Guest: goals list (NO goal_text fetched here)
  const [goals, setGoals] = useState<GoalPublicRow[]>([])
  const [goalCount, setGoalCount] = useState(0)

  // Guest: latest Greg update
  const [latestUpdate, setLatestUpdate] = useState<GregUpdateRow | null>(null)

  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setCountdownNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const nextNinePmEasternUtc = useMemo(
    () => getNextNinePmEasternUtc(new Date(countdownNowMs)),
    [countdownNowMs],
  )

  const msUntilNinePmEastern = nextNinePmEasternUtc.getTime() - countdownNowMs
  const isDeadlineReached = msUntilNinePmEastern <= 0

  const latestUpdateVideoUrl = useMemo(() => {
    if (!latestUpdate?.video_path) return null
    const sb = supabaseRef.current
    if (!sb) return null
    const { data } = sb.storage.from('greg-videos').getPublicUrl(latestUpdate.video_path)
    return data.publicUrl
  }, [latestUpdate?.video_path])

  // Greg page: password gate
  const expectedPassword = (import.meta.env.VITE_GREG_PAGE_PASSWORD as string | undefined) ?? ''
  const [gregUnlocked, setGregUnlocked] = useState(false)
  const [gregPassword, setGregPassword] = useState('')

  // Greg page: full goals + update creation
  const [gregGoals, setGregGoals] = useState<GoalFullRow[]>([])
  const [updateTitle, setUpdateTitle] = useState('')
  const [updateBody, setUpdateBody] = useState('')
  const [updateVideoFile, setUpdateVideoFile] = useState<File | null>(null)
  const [gregActionLoading, setGregActionLoading] = useState(false)
  const [gregActionError, setGregActionError] = useState<string | null>(null)
  const [gregActionSuccess, setGregActionSuccess] = useState<string | null>(null)
  const [supabaseDataError, setSupabaseDataError] = useState<string | null>(null)

  useEffect(() => {
    const sb = supabaseRef.current
    if (!sb) return

    const load = async () => {
      const [
        { data: goalsData, error: goalsError },
        { data: updateData, error: updateError },
        { count: goalsExactCount, error: goalsCountError },
      ] = await Promise.all([
          sb
            .from('goals_2025')
            .select('id,display_name,title,created_at')
            .order('created_at', { ascending: false })
            .limit(50),
          sb
            .from('greg_updates')
            .select('id,title,body,video_path,created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          sb.from('goals_2025').select('id', { count: 'exact', head: true }),
        ])

      const pretty = formatSupabaseDataError((goalsError ?? updateError ?? goalsCountError) as any)
      setSupabaseDataError(pretty)
      if (pretty && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('Supabase data load error:', { goalsError, updateError, goalsCountError })
      }

      setGoals((goalsData ?? []) as GoalPublicRow[])
      setLatestUpdate((updateData ?? null) as GregUpdateRow | null)
      setGoalCount(
        typeof goalsExactCount === 'number' ? goalsExactCount : (goalsData ?? []).length ?? 0,
      )
    }

    void load()
  }, [])

  useEffect(() => {
    const sb = supabaseRef.current
    if (!sb) return

    const channel = sb
      .channel('goals_2025_goalcount')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'goals_2025' },
        (payload) => {
          const row = payload.new as GoalPublicRow | null
          if (row?.id) {
            setGoals((prev) => {
              if (prev.some((g) => g.id === row.id)) return prev
              return [row, ...prev].slice(0, 50)
            })
          }
          setGoalCount((c) => (Number.isFinite(c) ? c + 1 : c))
        },
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!confetti) return
    const t = window.setTimeout(() => setConfetti(false), 2200)
    return () => window.clearTimeout(t)
  }, [confetti])

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const sb = supabaseRef.current
    if (!sb) {
      setGoalSubmitError('Supabase is not configured. Missing env vars.')
      return
    }

    setGoalSubmitError(null)
    setGoalSubmitSuccess(null)
    const dn = displayName.trim()
    const title = goalTitle.trim()
    const text = goalText.trim()
    if (!dn || !title || !text) {
      setGoalSubmitError('Please fill out your name, a short title, and your goal.')
      return
    }

    setGoalSubmitLoading(true)
    const { data, error } = await sb
      .from('goals_2025')
      .insert({ display_name: dn, title, goal_text: text })
      .select('id,display_name,title,created_at')
      .single()

    if (error) {
      setGoalSubmitError(
        formatSupabaseDataError(error as any) ?? 'Something went wrong. Please try again.',
      )
    } else if (data) {
      setGoalSubmitSuccess('Locked in. Greg will read it aloud in Denver.')
      setConfetti(true)
      setGoals((prev) => {
        const next = [data as GoalPublicRow, ...prev].slice(0, 50)
        setGoalCount((c) => (Number.isFinite(c) ? c + 1 : next.length))
        return next
      })
      setDisplayName('')
      setGoalTitle('')
      setGoalText('')
    }

    setGoalSubmitLoading(false)
  }

  const handleGregUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = expectedPassword && gregPassword === expectedPassword
    if (!ok) return
    setGregUnlocked(true)
    setGregPassword('')
  }

  const loadGregGoals = async () => {
    const sb = supabaseRef.current
    if (!sb) return
    const { data, error } = await sb
      .from('goals_2025')
      .select('id,display_name,title,goal_text,created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    const pretty = formatSupabaseDataError(error as any)
    if (pretty) setGregActionError(pretty)
    setGregGoals((data ?? []) as GoalFullRow[])
  }

  useEffect(() => {
    if (!isGregRoute || !gregUnlocked) return
    void loadGregGoals()
  }, [isGregRoute, gregUnlocked])

  const handlePublishGregUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    const sb = supabaseRef.current
    if (!sb) {
      setGregActionError('Supabase is not configured. Missing env vars.')
      return
    }

    setGregActionError(null)
    setGregActionSuccess(null)

    const t = updateTitle.trim()
    const b = updateBody.trim()
    if (!t || !b) {
      setGregActionError('Please enter a title and a message.')
      return
    }
    if (!updateVideoFile) {
      setGregActionError('Please choose a video file.')
      return
    }

    setGregActionLoading(true)
    try {
      const safeName = sanitizeFilename(updateVideoFile.name || 'greg-update.mp4')
      const videoPath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`

      const uploadRes = await sb.storage.from('greg-videos').upload(videoPath, updateVideoFile, {
        upsert: false,
        contentType: updateVideoFile.type || undefined,
      })

      if (uploadRes.error) {
        setGregActionError(
          'Video upload failed. Double check the bucket name and that it allows uploads.',
        )
        setGregActionLoading(false)
        return
      }

      const { data, error } = await sb
        .from('greg_updates')
        .insert({ title: t, body: b, video_path: videoPath })
        .select('id,title,body,video_path,created_at')
        .single()

      if (error) {
        setGregActionError(formatSupabaseDataError(error as any) ?? 'Update publish failed.')
      } else {
        setGregActionSuccess('Published.')
        setLatestUpdate((data ?? null) as GregUpdateRow | null)
        setUpdateTitle('')
        setUpdateBody('')
        setUpdateVideoFile(null)
      }
    } finally {
      setGregActionLoading(false)
    }
  }

  if (isGregRoute) {
    return (
      <>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.2, 7], fov: 45 }}
          eventSource={scrollContainerRef}
          eventPrefix="client"
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
        >
          <Suspense fallback={null}>
            <NewYearsBackdrop confetti={false} />
          </Suspense>
        </Canvas>
        <div ref={scrollContainerRef} className="relative min-h-dvh overflow-y-auto text-moonlight">
          <section className="relative min-h-dvh px-6 py-10">
            <div className="mx-auto w-full max-w-5xl">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Greg’s HQ (Denver)
                </h1>
                <a
                  href="/#welcome"
                  onClick={(e) => {
                    e.preventDefault()
                    window.history.pushState({}, '', '/')
                    window.location.hash = '#welcome'
                  }}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10"
                >
                  Back to party
                </a>
              </div>

              {!supabaseRef.current ? (
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  Supabase is not configured (missing `VITE_SUPABASE_URL` /
                  `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`).
                </div>
              ) : !expectedPassword ? (
                <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  Set `VITE_GREG_PAGE_PASSWORD` to enable the Greg page password gate.
                </div>
              ) : !gregUnlocked ? (
                <form
                  onSubmit={handleGregUnlock}
                  className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
                >
                  <p className="text-sm text-white/70">Enter the password.</p>
                  <input
                    className="mt-3 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-white/30"
                    type="password"
                    value={gregPassword}
                    onChange={(e) => setGregPassword(e.target.value)}
                    placeholder="Password"
                  />
                  <button
                    className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 font-semibold text-midnight"
                    type="submit"
                  >
                    Unlock
                  </button>
                </form>
              ) : (
                <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-lg font-semibold text-white">All goals (full text)</h2>
                      <button
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                        type="button"
                        onClick={() => void loadGregGoals()}
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {gregGoals.length ? (
                        gregGoals.map((g) => (
                          <div
                            key={g.id}
                            className="rounded-xl border border-white/10 bg-black/25 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-white">{g.title}</span>
                                <span className="text-sm text-white/60">by {g.display_name}</span>
                              </div>
                              <span className="text-xs text-white/50">
                                {formatWhen(g.created_at)}
                              </span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                              {g.goal_text}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/60">No goals yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                    <h2 className="text-lg font-semibold text-white">Post a Denver update</h2>
                    <form onSubmit={handlePublishGregUpdate} className="mt-4 space-y-4">
                      <div>
                        <label className="text-sm text-white/70">Title</label>
                        <input
                          className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-white/30"
                          value={updateTitle}
                          onChange={(e) => setUpdateTitle(e.target.value)}
                          placeholder="Tonight’s update…"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/70">Message</label>
                        <textarea
                          className="mt-2 h-32 w-full resize-none rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-white/30"
                          value={updateBody}
                          onChange={(e) => setUpdateBody(e.target.value)}
                          placeholder="Fun words from Denver…"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/70">Video file</label>
                        <input
                          className="mt-2 w-full text-sm text-white/70"
                          type="file"
                          accept="video/*"
                          onChange={(e) => setUpdateVideoFile(e.target.files?.[0] ?? null)}
                        />
                      </div>
                      {gregActionError ? (
                        <p className="text-sm text-red-200">{gregActionError}</p>
                      ) : null}
                      {gregActionSuccess ? (
                        <p className="text-sm text-green-200">{gregActionSuccess}</p>
                      ) : null}
                      <button
                        disabled={gregActionLoading}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 font-semibold text-midnight disabled:opacity-60"
                        type="submit"
                      >
                        {gregActionLoading ? 'Publishing…' : 'Publish update'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </>
    )
  }

  return (
    <>
      <StockTickerBanner />
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.2, 7], fov: 45 }}
        eventSource={scrollContainerRef}
        eventPrefix="client"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      >
        <Suspense fallback={null}>
          <NewYearsBackdrop confetti={confetti} />
        </Suspense>
      </Canvas>

      <div
        id="scroll-container"
        ref={scrollContainerRef}
        className="relative box-border h-dvh snap-y snap-mandatory overflow-y-auto pt-7 text-moonlight sm:pt-8"
      >
        <ScrollIndicator />

        <section id="welcome" className="relative h-dvh snap-start overflow-hidden">
          <div className="relative mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-8 text-center sm:px-6">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:max-w-2xl sm:p-10">
              <div className="ny-glow-orbs pointer-events-none absolute inset-0 opacity-35" />
              <div className="relative">
                <span className="ny-glass-strong ny-sheen inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/85">
                  New Year’s • 2025 • Virtual
                </span>

                <h1 className="ny-title mt-4 text-balance text-4xl font-bold tracking-tight sm:mt-6 sm:text-5xl md:text-7xl">
                  <span className="ny-sheen block bg-gradient-to-r from-gold via-ice to-aurora bg-clip-text text-transparent">
                    2026
                  </span>
                  <span className="mt-1 block text-white sm:mt-2">{`New Year's Goals`}</span>
                </h1>

                <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-white/75 sm:mt-5 sm:text-lg">
                  Drop your 2026 New Year's goal as we leave 2025 behind. Greg will read them aloud and deliver
                  commentary. Next year, you WILL be held accountable 🫵. Make this year count! 
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur sm:mt-6">
                  <span className="uppercase tracking-[0.28em] text-white/70">Submitted so far</span>
                  <span className="text-white/50">•</span>
                  <ScrollingNumber
                    value={goalCount}
                    className="text-white"
                    digitClassName="text-white"
                    durationMs={950}
                    startDelayMs={300}
                  />
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
                  <a
                    href="#submit"
                    className="ny-sheen rounded-xl bg-gradient-to-r from-gold via-white to-ice px-5 py-2.5 text-sm font-semibold text-midnight shadow-[0_18px_60px_rgba(247,212,106,0.18)] transition hover:brightness-105 sm:px-6 sm:py-3"
                  >
                    Submit a goal
                  </a>
                  <a
                    href="#watch"
                    className="ny-glass rounded-xl px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10 sm:px-6 sm:py-3"
                  >
                    Watch Greg’s Ratification
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="watch" className="relative h-dvh snap-start overflow-hidden">
          <div className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-6 px-6 py-10">
            <h2 className="ny-title text-3xl font-semibold text-white md:text-4xl">
              Greg’s NYE Goal Ratification
            </h2>

            <DramaticCountdown
              msRemaining={msUntilNinePmEastern}
              isReached={isDeadlineReached}
              deadlineLabel="Goals lock at 9:00 PM EST"
            />

            {!supabaseRef.current ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80 backdrop-blur">
                Supabase is not configured (missing `VITE_SUPABASE_URL` /
                `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`).
              </div>
            ) : supabaseDataError ? (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-6 text-white/85 backdrop-blur">
                <div className="font-semibold text-white">Supabase setup issue</div>
                <div className="mt-2 text-sm text-white/80">{supabaseDataError}</div>
              </div>
            ) : latestUpdate ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="ny-glass relative overflow-hidden rounded-3xl p-6">
                  <div className="ny-glow-orbs absolute inset-0 opacity-40" />
                  <div className="relative">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="ny-title text-xl font-semibold text-white">
                        {latestUpdate.title}
                      </h3>
                      <span className="text-xs text-white/60">
                        {formatWhen(latestUpdate.created_at)}
                      </span>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-white/75">{latestUpdate.body}</p>
                  </div>
                </div>
                <div className="ny-glass overflow-hidden rounded-3xl bg-black/30">
                  {latestUpdateVideoUrl ? (
                    <video
                      controls
                      playsInline
                      className="h-full w-full"
                      src={latestUpdateVideoUrl}
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-sm text-white/60">
                      No video URL available.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ny-glass rounded-3xl p-6 text-white/80">
                No update posted yet. Check back soon.
              </div>
            )}
          </div>
        </section>

        <section id="goals" className="relative h-dvh snap-start overflow-hidden">
          <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-6 py-10">
            <div className="flex items-end justify-between gap-4">
              <h2 className="ny-title text-3xl font-semibold text-white md:text-4xl">Goals</h2>
              <a
                className="text-sm text-white/70 underline-offset-4 hover:underline"
                href="#submit"
              >
                Add yours
              </a>
            </div>

            <div className="ny-glass mt-6 overflow-hidden rounded-3xl">
              <div className="max-h-[70vh] overflow-y-auto p-4 md:p-6">
                {goals.length ? (
                  <ul className="space-y-3">
                    {goals.map((g) => (
                      <li
                        key={g.id}
                        className="rounded-2xl border border-white/10 bg-gradient-to-r from-black/25 via-black/15 to-black/25 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-baseline gap-2">
                            <span className="ny-title font-semibold text-white">{g.title}</span>
                            <span className="text-sm text-white/60">by {g.display_name}</span>
                          </div>
                          <span className="text-xs text-white/50">{formatWhen(g.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-white/60">No goals yet. Be the first.</p>
                )}
              </div>
            </div>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50">
              <p>&copy; 2025 Virtual New Year’s Celebration</p>
              <div className="flex items-center gap-3">
                <a className="transition hover:text-white/70" href="#welcome">
                  Top
                </a>
                <span aria-hidden="true">•</span>
                <a className="transition hover:text-white/70" href="#watch">
                  Greg
                </a>
                <span aria-hidden="true">•</span>
                <a className="transition hover:text-white/70" href="#submit">
                  Submit
                </a>
              </div>
            </footer>
          </div>
        </section>

        <section
          id="submit"
          className="relative min-h-dvh snap-start overflow-visible md:h-dvh md:overflow-hidden"
        >
          <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-start justify-center px-6 py-6 md:h-full md:py-10">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="ny-glass relative overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8">
                <div className="ny-glow-orbs absolute inset-0 opacity-35" />
                <div className="relative">
                  <h2 className="ny-title text-3xl font-semibold text-white md:text-4xl">
                    Your 2025 goal
                  </h2>
                  <p className="mt-3 text-white/70">
                    Write it like you mean it. Greg will read the title + who it’s from publicly.
                    The full text is for Greg’s eyes only (we don’t fetch it on the public page).
                  </p>

                  <form onSubmit={handleGoalSubmit} className="mt-8 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-white/75">Your name</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 text-white placeholder-white/35 outline-none ring-1 ring-transparent focus:border-white/30 focus:ring-ice/30 md:py-3"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Nicole"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/75">Short title</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 text-white placeholder-white/35 outline-none ring-1 ring-transparent focus:border-white/30 focus:ring-gold/25 md:py-3"
                        value={goalTitle}
                        onChange={(e) => setGoalTitle(e.target.value)}
                        placeholder="e.g. Run a 10K"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/75">
                        The full goal (Greg reads this)
                      </label>
                      <textarea
                        className="mt-2 h-28 w-full resize-none rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 text-white placeholder-white/35 outline-none ring-1 ring-transparent focus:border-white/30 focus:ring-aurora/25 md:h-36 md:py-3"
                        value={goalText}
                        onChange={(e) => setGoalText(e.target.value)}
                        placeholder="Write the details, the why, the how…"
                        required
                      />
                    </div>

                    {goalSubmitError ? (
                      <p className="text-sm text-red-200">{goalSubmitError}</p>
                    ) : null}
                    {goalSubmitSuccess ? (
                      <p className="text-sm text-green-200">{goalSubmitSuccess}</p>
                    ) : null}

                    <button
                      disabled={goalSubmitLoading || !supabaseRef.current}
                      className="ny-sheen inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-gold via-white to-ice px-6 py-3 text-sm font-semibold text-midnight shadow-[0_18px_60px_rgba(125,211,252,0.12)] disabled:opacity-60 md:py-4"
                      type="submit"
                    >
                      {goalSubmitLoading
                        ? 'Submitting…'
                        : !supabaseRef.current
                          ? 'Unavailable'
                          : 'Submit goal'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="ny-glass hidden rounded-3xl p-8 lg:block">
                <h3 className="ny-title text-xl font-semibold text-white">What happens next?</h3>
                <ol className="mt-4 space-y-3 text-sm text-white/70">
                  <li>
                    <span className="font-semibold text-white/80">1.</span> Your goal gets added to
                    the wall (title + name).
                  </li>
                  <li>
                    <span className="font-semibold text-white/80">2.</span> Greg reads the full
                    details and reacts.
                  </li>
                  <li>
                    <span className="font-semibold text-white/80">3.</span> We start 2025 with
                    momentum.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section id="greg" className="relative h-dvh snap-start overflow-hidden">
          <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-6 py-10">
            <div className="ny-glass relative overflow-hidden rounded-3xl p-8 text-center">
              <div className="ny-glow-orbs absolute inset-0 opacity-35" />
              <div className="relative">
                <h2 className="ny-title text-3xl font-semibold text-white md:text-4xl">
                  Are you Greg?
                </h2>
                <p className="mt-3 text-sm text-white/70">If yes, click here for the admin view.</p>
                <a
                  href="/Greg"
                  onClick={(e) => {
                    e.preventDefault()
                    window.history.pushState({}, '', '/Greg')
                    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
                  }}
                  className="ny-sheen mt-6 inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-midnight transition hover:bg-white/90"
                >
                  See admin view.
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

export default App
