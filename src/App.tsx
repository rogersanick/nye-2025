import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, View } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Object3D } from 'three'

import ScrollIndicator from './components/ScrollIndicator'
import { createClient } from './lib/supabaseClient'
const schedule = [
  {
    time: '4:30-5 PM',
    title: 'Doors Open',
    detail: 'THIS IS HALLOWEEEN, THIS IS HALLOWEEN.',
  },
  {
    time: '8:00 PM',
    title: 'Winner Announcement',
    detail: 'We will announce the winner of the costume contest.',
  },
  { time: '10:00 PM', title: 'Bedtime', detail: 'Time to say goodbye and head home.' },
]

const INITIAL_PUMPKINS = 100
const MAX_PUMPKINS = 45
const PUMPKIN_LIFETIME = 30000
const CLEANUP_HEIGHT = -6
const GROUND_TILT = 0
const CURSOR_PLANE_HEIGHT = 1.2

type PumpkinData = {
  id: number
  rotation: [number, number, number]
  position: [number, number, number]
  scale: number
  createdAt: number
}

function PumpkinInstance({
  data,
  model,
  onRemove,
}: {
  data: PumpkinData
  model: Object3D
  onRemove: (id: number) => void
}) {
  const bodyRef = useRef<RapierRigidBody | null>(null)
  const hasRemoved = useRef(false)
  const clonedScene = useMemo(() => model.clone(), [model])

  useFrame(() => {
    if (hasRemoved.current || !bodyRef.current) return

    const { y } = bodyRef.current.translation()
    if (y < CLEANUP_HEIGHT) {
      hasRemoved.current = true
      onRemove(data.id)
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      colliders="ball"
      restitution={0.7}
      rotation={data.rotation}
      friction={0.3}
      position={data.position}
    >
      <primitive
        object={clonedScene}
        scale={data.scale}
        rotation={data.rotation}
        castShadow
        receiveShadow
      />
    </RigidBody>
  )
}

function CursorBumper() {
  const bodyRef = useRef<RapierRigidBody | null>(null)
  const pointer = useRef(new Vector2(0, 0))
  const { camera, size } = useThree()

  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -CURSOR_PLANE_HEIGHT), [])
  const raycaster = useMemo(() => new Raycaster(), [])
  const intersectionPoint = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      pointer.current.set(
        (event.clientX / size.width) * 2 - 1,
        -(event.clientY / size.height) * 2 + 1,
      )
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [size.height, size.width])

  useFrame(() => {
    if (!bodyRef.current) return

    raycaster.setFromCamera(pointer.current, camera)
    const point = raycaster.ray.intersectPlane(plane, intersectionPoint)

    if (point) {
      bodyRef.current.setNextKinematicTranslation({ x: point.x, y: point.y, z: point.z })
    }
  })

  return (
    <RigidBody
      type="kinematicPosition"
      colliders="ball"
      ref={bodyRef}
      enabledRotations={[false, false, false]}
    >
      <mesh visible={false}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </RigidBody>
  )
}

function LandingViewScene() {
  const { scene } = useGLTF('/jackolantern.glb')

  const pumpkinTemplate = useMemo(() => {
    const preparedScene = scene.clone()
    preparedScene.traverse((child) => {
      if (child.type === 'Mesh' && (child as any).material) {
        const mesh = child as any
        if (child.name.toLowerCase().includes('pumpkin')) {
          mesh.material.color.set('#ff6600')
        } else if (child.name.toLowerCase().includes('vine')) {
          mesh.material.color.set('#228b22')
        }
      }
    })

    return preparedScene
  }, [scene])

  const [pumpkins, setPumpkins] = useState<PumpkinData[]>(() => {
    const now = Date.now()
    return Array.from({ length: INITIAL_PUMPKINS }, (_, index) => ({
      id: index,
      position: [(Math.random() - 0.5) * 4, Math.random() * 4 + 4, (Math.random() - 1) * 4],
      rotation: [0, Math.random() * 2 * Math.PI, 0],
      scale: Math.random() * 0.8 + 0.3,
      createdAt: now - Math.random() * 2000,
    }))
  })

  const nextId = useRef(pumpkins.length)

  const generatePumpkin = useCallback((): PumpkinData => {
    const id = nextId.current++
    return {
      id,
      position: [(Math.random() - 0.5) * 8, Math.random() * 4 + 6, (Math.random() - 0.5) * 8],
      rotation: [0, Math.random() * 2 * Math.PI, 0],
      scale: Math.random() * 0.8 + 0.3,
      createdAt: Date.now(),
    }
  }, [nextId])

  const removePumpkin = useCallback((id: number) => {
    setPumpkins((previous) => previous.filter((pumpkin) => pumpkin.id !== id))
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPumpkins((previous) => {
        const now = Date.now()
        const filtered = previous.filter((pumpkin) => now - pumpkin.createdAt < PUMPKIN_LIFETIME)
        const nextPumpkin = generatePumpkin()
        const withNext = [...filtered, nextPumpkin]
        return withNext.slice(-MAX_PUMPKINS)
      })
    }, 1500)

    return () => window.clearInterval(interval)
  }, [generatePumpkin])

  return (
    <>
      <ambientLight intensity={1} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} castShadow />
      <Physics gravity={[0, -2, 0]}>
        {pumpkins.map((pumpkin) => (
          <PumpkinInstance
            key={pumpkin.id}
            data={pumpkin}
            model={pumpkinTemplate}
            onRemove={removePumpkin}
          />
        ))}

        <CursorBumper />

        {/* Invisible walls to contain pumpkins */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.1, 10, 8]} position={[-6, 5, 0]} />
          <CuboidCollider args={[0.1, 10, 8]} position={[6, 5, 0]} />
          <CuboidCollider args={[8, 10, 0.1]} position={[0, 5, -6]} />
          <CuboidCollider args={[8, 10, 0.1]} position={[0, 5, 6]} />
        </RigidBody>

        {/* Ground with cleanup trigger */}
        <RigidBody type="fixed" colliders={false} position={[0, -2, 0]}>
          <CuboidCollider args={[8, 0.25, 8]} rotation={[GROUND_TILT, 0, 0]} />
          <mesh rotation={[-Math.PI / 2 + GROUND_TILT, 0, 0]} receiveShadow>
            <circleGeometry args={[9, 64]} />
            <meshStandardMaterial color="#0f172a" roughness={1} transparent opacity={0} />
          </mesh>
        </RigidBody>

        {/* Cleanup zone below ground */}
        <RigidBody type="fixed" colliders={false} position={[0, -8, 0]}>
          <CuboidCollider args={[10, 1, 10]} sensor />
        </RigidBody>
      </Physics>
    </>
  )
}

function App() {
  const scrollContainerRef = useRef<HTMLDivElement>(null!)
  const supabaseRef = useRef(createClient())

  type RsvpRow = {
    id: string
    name: string
    costume: string | null
    coming: boolean
    created_at: string
  }

  const [name, setName] = useState('')
  const [costume, setCostume] = useState('')
  const [coming, setComing] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const [attendees, setAttendees] = useState<RsvpRow[]>([])

  useEffect(() => {
    const loadAttendees = async () => {
      if (!supabaseRef.current) return
      const { data } = await supabaseRef.current
        .from('rsvps')
        .select('id,name,costume,coming,created_at')
        .eq('coming', true)
        .order('created_at', { ascending: false })
      setAttendees(data ?? [])
    }
    void loadAttendees()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseRef.current) {
      setSubmitError('RSVP is not configured. Missing env vars.')
      return
    }
    setSubmitError(null)
    setSubmitSuccess(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setSubmitError('Please enter your name')
      return
    }

    setSubmitLoading(true)
    const { data, error } = await supabaseRef.current
      .from('rsvps')
      .insert({ name: trimmedName, costume: costume.trim() || null, coming })
      .select('id,name,costume,coming,created_at')
      .single()

    if (error) {
      setSubmitError('Something went wrong. Please try again.')
    } else {
      setSubmitSuccess(coming ? "You're on the list!" : 'Saved your response!')
      // Optimistically update attendee list if they are coming
      if (data && data.coming) {
        setAttendees((prev) => [data as RsvpRow, ...prev])
      }
      setName('')
      setCostume('')
      setComing(true)
    }
    setSubmitLoading(false)
  }

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.4, 6], fov: 45 }}
        eventSource={scrollContainerRef}
        eventPrefix="client"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <View.Port />
      </Canvas>
      <div
        id="scroll-container"
        ref={scrollContainerRef}
        className="relative h-dvh snap-y snap-mandatory overflow-y-auto text-moonlight"
      >
        <ScrollIndicator />
        <section id="home" className="relative h-dvh snap-start overflow-hidden">
          <View
            index={1}
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <LandingViewScene />
            </Suspense>
          </View>
          <div className="flex h-full w-full px-8">
            <div className="pointer-events-none absolute inset-0 -z-20 opacity-60">
              <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pumpkin blur-[120px]" />
              <div className="absolute right-12 top-1/4 h-64 w-64 rounded-full bg-poison/70 blur-[100px]" />
              <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-ember/60 blur-[120px]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center gap-8 px-6 text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em]">
                Oct 31 • 4pm — 10pm
              </span>
              <h1 className="max-w-lg font-spooky text-5xl tracking-wider text-amber-200 drop-shadow-[0_0_25px_rgba(249,115,22,0.45)] md:text-7xl">
                Besties, Babies, Boos, and Booze
              </h1>
              <div className="flex flex-col items-center justify-center gap-2">
                <p className="max-w-2xl text-lg leading-relaxed text-white/80">
                  Come one, come all to the spookiest party on Edgewood Lane 👻
                </p>
                <p className="max-w-2xl text-lg leading-relaxed text-white/80">
                  Scroll down to RSVP and add a costumer hint 👀
                </p>
              </div>
            </div>

            <div className="absolute bottom-4 ml-4 transform">
              <p className="text-xs text-white/50">
                <i>Sponsored by the FOA (Friends of Aaron Association)</i>
              </p>
              <p className="text-xs text-white/50">
                <i>
                  If you are not already part of this association, don't worry - you will be soon.
                  Just meet Aaron.
                </i>
              </p>
            </div>
          </div>
        </section>
        <section id="rsvp" className="relative h-dvh snap-start overflow-hidden">
          <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-6 py-6">
            <div className="flex justify-center">
              {/* RSVP Card */}
              <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-pumpkin/40 bg-gradient-to-br from-pumpkin via-ember to-pumpkin/70 p-8 text-midnight shadow-[0_15px_45px_rgba(249,115,22,0.45)]">
                <div className="absolute -right-12 top-1/2 h-48 w-full -translate-y-1/2 rounded-full border border-white/40 opacity-40" />
                <div className="absolute -left-16 -top-16 rounded-full border border-white/40 opacity-30" />
                <div className="relative flex flex-col gap-4">
                  <div className="space-y-4">
                    <h2 className="font-spooky text-4xl text-midnight lg:text-5xl">
                      RSVP for you & your 👻
                    </h2>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-lg font-semibold">
                        Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        className="mt-2 w-full rounded-lg border border-black/10 bg-white/90 px-4 py-3 text-lg text-black placeholder-black/40 shadow-sm focus:border-black/30 focus:outline-none"
                        placeholder="e.g. Sally Skellington"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="costume hint" className="block text-lg font-semibold">
                        Costume Hint
                      </label>
                      <input
                        id="costume hint"
                        type="text"
                        className="mt-2 w-full rounded-lg border border-black/10 bg-white/90 px-4 py-3 text-lg text-black placeholder-black/40 shadow-sm focus:border-black/30 focus:outline-none"
                        placeholder="e.g. Vampire Accountant 🧛‍♂️🧮"
                        value={costume}
                        onChange={(e) => setCostume(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="coming"
                        type="checkbox"
                        className="h-5 w-5 rounded border-black/30 text-amber-600 focus:ring-amber-500"
                        checked={coming}
                        onChange={(e) => setComing(e.target.checked)}
                      />
                      <label htmlFor="coming" className="select-none text-lg">
                        I'm coming!
                      </label>
                    </div>
                    {submitError ? (
                      <p className="text-base font-medium text-red-900">{submitError}</p>
                    ) : null}
                    {submitSuccess ? (
                      <p className="text-base font-medium text-green-900">{submitSuccess}</p>
                    ) : null}
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-midnight px-6 py-4 text-lg font-semibold text-amber-200 shadow hover:bg-black/90 disabled:opacity-60"
                      disabled={submitLoading || !supabaseRef.current}
                    >
                      {submitLoading
                        ? 'Submitting…'
                        : !supabaseRef.current
                          ? 'RSVP unavailable'
                          : 'Submit RSVP'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="attendees" className="relative h-dvh snap-start overflow-hidden">
          <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-center px-6 py-12">
            <div className="flex flex-col items-center">
              <h2 className="mb-8 font-spooky text-4xl text-amber-200 lg:text-5xl">
                Who's Coming
              </h2>
              {/* Attendees List */}
              <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="max-h-[400px] overflow-y-auto rounded-lg bg-white/60 text-black shadow lg:max-h-[500px]">
                  <ul className="divide-y divide-black/10">
                    {attendees.map((a) => (
                      <li key={a.id} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{a.name}</span>
                            <span className="text-sm">{a.coming ? '✅' : '❌'}</span>
                          </div>
                          <span className="text-xs text-black/60">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {a.costume ? (
                          <p className="text-sm text-black/80">Costume: {a.costume}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          id="location"
          className="relative mx-auto flex h-dvh max-w-4xl snap-start flex-col justify-center px-6 py-12"
        >
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
            <h2 className="font-spooky text-4xl text-amber-200">Location</h2>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2847.5233128266973!2d-73.20575698746742!3d44.46344497095466!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4cca7bb28d56ef3b%3A0x586fbfd8408f7e33!2s32%20Edgewood%20Ln%2C%20Burlington%2C%20VT%2005401!5e0!3m2!1sen!2sus!4v1760406547733!5m2!1sen!2sus"
              className="h-full min-h-[450px] w-full"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </section>
        <section id="schedule" className="h-dvh snap-start">
          <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-center px-4 py-6">
            <div className="grid gap-10 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur lg:grid-cols-[2fr_3fr]">
              <div className="space-y-6">
                <h2 className="font-spooky text-4xl text-amber-200">Evening Schedule</h2>
              </div>
              <ol className="space-y-4 border-l border-white/10 pl-2">
                {schedule.map((item) => (
                  <li key={item.title} className="relative pl-6">
                    <span className="absolute -left-[15px] top-1.5 h-3 w-3 rounded-full bg-pumpkin shadow-[0_0_10px_rgba(249,115,22,0.7)]" />
                    <div className="flex flex-col gap-1 rounded-lg bg-black/30 p-3">
                      <span className="text-xs uppercase tracking-[0.3em] text-pumpkin">
                        {item.time}
                      </span>
                      <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                      <p className="text-sm text-white/70">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <footer className="mt-auto border-t border-white/10 bg-black/40 py-10">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
              <p>&copy; 2025 Babies, Boos, and Booze. See you on Edgewood Lane.</p>
              <div className="flex items-center gap-4">
                <a className="transition hover:text-pumpkin" href="#schedule">
                  Schedule
                </a>
                <span aria-hidden="true">•</span>
                <a className="transition hover:text-pumpkin" href="#rsvp">
                  RSVP
                </a>
                <span aria-hidden="true">•</span>
                <a
                  className="transition hover:text-pumpkin"
                  href="https://maps.app.goo.gl/?q=32+Edgewood+Ln+Burlington+VT+05041"
                >
                  Directions
                </a>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </>
  )
}

useGLTF.preload('/jackolantern.glb')

export default App
