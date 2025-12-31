import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

type ConfettiColor = string | number | THREE.Color

type ConfettiParticle = THREE.Mesh & {
  destination: { x: number; y: number; z: number }
  rotateSpeedX: number
  rotateSpeedY: number
  rotateSpeedZ: number
}

type ConfettiBoom = THREE.Object3D & {
  dispose?: () => void
}

interface ExplosionConfettiProps {
  isExploding?: boolean
  amount?: number
  rate?: number
  radius?: number
  areaWidth?: number
  areaHeight?: number
  fallingHeight?: number
  fallingSpeed?: number
  colors?: ConfettiColor[]
  enableShadows?: boolean
}

const ExplosionConfetti = ({
  isExploding = false,
  amount = 110,
  rate = 4, // careful: high numbers can be expensive
  radius = 12,
  areaWidth = 3.5,
  areaHeight = 1,
  fallingHeight = 10,
  fallingSpeed = 7,
  colors = ['#f7d46a', '#ffffff', '#60a5fa', '#a78bfa'],
  enableShadows = false,
}: ExplosionConfettiProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const boomsRef = useRef<ConfettiBoom[]>([])

  const adjustedRate = rate / 100
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.03, 0.03, 1, 1), [])

  const explode = () => {
    const boom: ConfettiBoom = new THREE.Object3D()
    boom.position.x = -(areaWidth / 2) + areaWidth * Math.random()
    boom.position.y = fallingHeight + areaHeight - fallingSpeed
    boom.position.z = -(areaWidth / 2) + areaWidth * Math.random()
    groupRef.current?.add(boom)
    boomsRef.current.push(boom)

    for (let i = 0; i < amount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)] as any,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
      })
      const particle = new THREE.Mesh(geometry, material) as unknown as ConfettiParticle
      particle.castShadow = enableShadows
      boom.add(particle)

      particle.destination = {
        x: (Math.random() - 0.5) * (radius * 2) * Math.random(),
        y: (Math.random() - 0.5) * (radius * 2) - fallingSpeed * Math.random(),
        z: (Math.random() - 0.5) * (radius * 2) * Math.random(),
      }

      particle.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      )

      const size = Math.random() * 2 + 1
      particle.scale.set(size, size, size)

      particle.rotateSpeedX = Math.random() * 0.8 - 0.4
      particle.rotateSpeedY = Math.random() * 0.8 - 0.4
      particle.rotateSpeedZ = Math.random() * 0.8 - 0.4
    }

    boom.dispose = () => {
      for (const child of [...boom.children]) {
        const mesh = child as THREE.Mesh
        const material = mesh.material as THREE.Material | THREE.Material[]
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material.dispose()
        mesh.geometry.dispose()
        boom.remove(child)
      }
      groupRef.current?.remove(boom)
    }
  }

  useFrame(() => {
    if (isExploding && Math.random() < adjustedRate) explode()

    const booms = boomsRef.current
    if (!booms.length) return

    for (let b = booms.length - 1; b >= 0; b--) {
      const boom = booms[b]
      for (let i = boom.children.length - 1; i >= 0; i--) {
        const particle = boom.children[i] as ConfettiParticle

        particle.destination.y -= THREE.MathUtils.randFloat(0.1, 0.3)

        const speedX = (particle.destination.x - particle.position.x) / 200
        const speedY = (particle.destination.y - particle.position.y) / 200
        const speedZ = (particle.destination.z - particle.position.z) / 200

        particle.position.x += speedX
        particle.position.y += speedY
        particle.position.z += speedZ

        particle.rotation.y += particle.rotateSpeedY
        particle.rotation.x += particle.rotateSpeedX
        particle.rotation.z += particle.rotateSpeedZ

        const mat = particle.material as THREE.MeshBasicMaterial
        mat.opacity = Math.max(0, mat.opacity - THREE.MathUtils.randFloat(0.006, 0.012))

        if (particle.position.y < -fallingHeight || mat.opacity <= 0.001) {
          mat.dispose()
          particle.geometry.dispose()
          boom.remove(particle)
        }
      }

      if (boom.children.length === 0) {
        boom.dispose?.()
        booms.splice(b, 1)
      }
    }
  })

  return <group ref={groupRef} />
}

export default ExplosionConfetti
