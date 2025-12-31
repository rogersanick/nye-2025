import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

type FireworkSpawnOptions = {
  count?: number
  radius?: number
  size?: number
  duration?: number
  color?: THREE.Color
  shape?: 'sphere' | 'ring' | 'palm' | 'disc'
  texture?: 'soft' | 'ring' | 'spark' | 'streak'
}

export type ShaderFireworksRef = {
  spawn: (position: THREE.Vector3, options?: FireworkSpawnOptions) => void
}

type Explosion = {
  points: THREE.Points
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  age: number
  duration: number
}

const remapGLSL = `
float remap(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}
`

// Ported from the user reference:
// /Users/nicholasrogers/Downloads/34-fireworks-shaders-final/src/shaders/firework/vertex.glsl
const fireworkVertexShader = `
uniform float uSize;
uniform vec2 uResolution;
uniform float uProgress;

attribute float aSize;
attribute float aTimeMultiplier;

${remapGLSL}

void main() {
  float progress = uProgress * aTimeMultiplier;
  vec3 newPosition = position;

  // Exploding
  float explodingProgress = remap(progress, 0.0, 0.1, 0.0, 1.0);
  explodingProgress = clamp(explodingProgress, 0.0, 1.0);
  explodingProgress = 1.0 - pow(1.0 - explodingProgress, 3.0);
  newPosition *= explodingProgress;

  // Falling
  float fallingProgress = remap(progress, 0.1, 1.0, 0.0, 1.0);
  fallingProgress = clamp(fallingProgress, 0.0, 1.0);
  fallingProgress = 1.0 - pow(1.0 - fallingProgress, 3.0);
  newPosition.y -= fallingProgress * 0.2;

  // Scaling
  float sizeOpeningProgress = remap(progress, 0.0, 0.125, 0.0, 1.0);
  float sizeClosingProgress = remap(progress, 0.125, 1.0, 1.0, 0.0);
  float sizeProgress = min(sizeOpeningProgress, sizeClosingProgress);
  sizeProgress = clamp(sizeProgress, 0.0, 1.0);

  // Twinkling
  float twinklingProgress = remap(progress, 0.2, 0.8, 0.0, 1.0);
  twinklingProgress = clamp(twinklingProgress, 0.0, 1.0);
  float sizeTwinkling = sin(progress * 30.0) * 0.5 + 0.5;
  sizeTwinkling = 1.0 - sizeTwinkling * twinklingProgress;

  // Final position
  vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;

  // Final size
  gl_PointSize = uSize * uResolution.y * aSize * sizeProgress * sizeTwinkling;
  gl_PointSize *= 1.0 / -viewPosition.z;

  if (gl_PointSize < 1.0) gl_Position = vec4(9999.9);
}
`

// Ported from the user reference:
// /Users/nicholasrogers/Downloads/34-fireworks-shaders-final/src/shaders/firework/fragment.glsl
const fireworkFragmentShader = `
uniform sampler2D uTexture;
uniform vec3 uColor;

void main() {
  float textureAlpha = texture(uTexture, gl_PointCoord).r;
  gl_FragColor = vec4(uColor, textureAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function createAlphaTextureSoft() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.65, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.flipY = false
  return tex
}

function createAlphaTextureRing() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.28
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = size * 0.06
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Soft falloff
  const g = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, size * 0.52)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.flipY = false
  return tex
}

function createAlphaTextureSpark() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const cx = size / 2
  const cy = size / 2
  ctx.clearRect(0, 0, size, size)

  // 8-point star sparkle
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 6
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4)
    ctx.beginPath()
    ctx.moveTo(-42, 0)
    ctx.lineTo(42, 0)
    ctx.stroke()
  }
  ctx.restore()

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.flipY = false
  return tex
}

function createAlphaTextureStreak() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, size, size)
  const g = ctx.createLinearGradient(0, size / 2, size, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.18)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, size * 0.46, size, size * 0.08)

  const g2 = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g2.addColorStop(0, 'rgba(255,255,255,0.65)')
  g2.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  g2.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.flipY = false
  return tex
}

export const ShaderFireworks = forwardRef<ShaderFireworksRef, { maxExplosions?: number }>(
  ({ maxExplosions = 24 }, ref) => {
    const groupRef = useRef<THREE.Group>(null)
    const explosionsRef = useRef<Explosion[]>([])
    const { gl, size } = useThree()

    const textures = useMemo(
      () => ({
        soft: createAlphaTextureSoft(),
        ring: createAlphaTextureRing(),
        spark: createAlphaTextureSpark(),
        streak: createAlphaTextureStreak(),
      }),
      [],
    )
    const resolution = useMemo(() => new THREE.Vector2(), [])

    useEffect(() => {
      const dpr = gl.getPixelRatio()
      resolution.set(size.width * dpr, size.height * dpr)
    }, [gl, size.height, size.width, resolution])

    const spawn = (position: THREE.Vector3, options?: FireworkSpawnOptions) => {
      if (!groupRef.current) return
      const texKey = options?.texture ?? 'soft'
      const alphaTexture = textures[texKey]
      if (!alphaTexture) return

      const count = options?.count ?? Math.round(650 + Math.random() * 900)
      const radius = options?.radius ?? 0.8 + Math.random() * 1.1
      const uSize = options?.size ?? 0.07 + Math.random() * 0.05
      const duration = options?.duration ?? 2.6
      const shape = options?.shape ?? 'sphere'
      const color = options?.color ?? new THREE.Color().setHSL(Math.random(), 1, 0.7)

      // Cap number of active explosions to avoid runaway GPU memory.
      const active = explosionsRef.current
      if (active.length >= maxExplosions) {
        const old = active.shift()
        if (old) {
          groupRef.current.remove(old.points)
          old.geometry.dispose()
          old.material.dispose()
        }
      }

      const positionsArray = new Float32Array(count * 3)
      const sizesArray = new Float32Array(count)
      const timeMultipliersArray = new Float32Array(count)

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        let x = 0
        let y = 0
        let z = 0

        if (shape === 'ring') {
          // Flat-ish ring in XZ with a little vertical jitter
          const r = radius * (0.82 + Math.random() * 0.18)
          const theta = Math.random() * Math.PI * 2
          x = r * Math.cos(theta)
          z = r * Math.sin(theta)
          y = (Math.random() - 0.5) * radius * 0.15
        } else if (shape === 'disc') {
          // Filled disc with more density towards edge
          const theta = Math.random() * Math.PI * 2
          const r = radius * (0.35 + Math.random() * 0.65)
          x = r * Math.cos(theta)
          z = r * Math.sin(theta)
          y = (Math.random() - 0.5) * radius * 0.2
        } else if (shape === 'palm') {
          // “Palm” burst: mostly upward hemisphere
          const r = radius * (0.75 + Math.random() * 0.25)
          const phi = Math.random() * (Math.PI * 0.6)
          const theta = Math.random() * Math.PI * 2
          x = r * Math.sin(phi) * Math.cos(theta)
          y = r * Math.cos(phi)
          z = r * Math.sin(phi) * Math.sin(theta)
        } else {
          // sphere (default)
          const r = radius * (0.75 + Math.random() * 0.25)
          const phi = Math.random() * Math.PI
          const theta = Math.random() * Math.PI * 2
          x = r * Math.sin(phi) * Math.cos(theta)
          y = r * Math.cos(phi)
          z = r * Math.sin(phi) * Math.sin(theta)
        }

        positionsArray[i3] = x
        positionsArray[i3 + 1] = y
        positionsArray[i3 + 2] = z

        sizesArray[i] = Math.random()
        timeMultipliersArray[i] = 1 + Math.random()
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionsArray, 3))
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizesArray, 1))
      geometry.setAttribute(
        'aTimeMultiplier',
        new THREE.Float32BufferAttribute(timeMultipliersArray, 1),
      )

      const material = new THREE.ShaderMaterial({
        vertexShader: fireworkVertexShader,
        fragmentShader: fireworkFragmentShader,
        uniforms: {
          uSize: new THREE.Uniform(uSize),
          uResolution: new THREE.Uniform(resolution),
          uTexture: new THREE.Uniform(alphaTexture),
          uColor: new THREE.Uniform(color),
          uProgress: new THREE.Uniform(0),
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: true,
      })

      const points = new THREE.Points(geometry, material)
      points.position.copy(position)
      groupRef.current.add(points)

      active.push({ points, geometry, material, age: 0, duration })
    }

    useImperativeHandle(ref, () => ({ spawn }), [textures, resolution])

    useFrame((_, delta) => {
      const group = groupRef.current
      if (!group) return
      const active = explosionsRef.current
      if (!active.length) return

      for (let i = active.length - 1; i >= 0; i--) {
        const ex = active[i]
        ex.age += delta
        const t = Math.min(1, ex.age / ex.duration)
        ex.material.uniforms.uProgress.value = t

        if (t >= 1) {
          group.remove(ex.points)
          ex.geometry.dispose()
          ex.material.dispose()
          active.splice(i, 1)
        }
      }
    })

    return <group ref={groupRef} />
  },
)

ShaderFireworks.displayName = 'ShaderFireworks'
