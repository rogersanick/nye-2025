import { useEffect, useState } from 'react'

const ScrollIndicator: React.FC = () => {
  const [activeSection, setActiveSection] = useState(0)
  const [hoveredSection, setHoveredSection] = useState<number | null>(null)
  const [sectionElements, setSectionElements] = useState<HTMLElement[]>([])

  useEffect(() => {
    const scrollContainer = document.getElementById('scroll-container')
    const sections = scrollContainer ? Array.from(scrollContainer.querySelectorAll('section')) : []
    setSectionElements(sections as HTMLElement[])
  }, [])

  const onScroll = () => {
    const scrollContainer = document.getElementById('scroll-container')
    if (scrollContainer) {
      const scrollY = scrollContainer.scrollTop + scrollContainer.clientHeight / 2
      const currentSectionIndex = sectionElements.findIndex((section) => {
        const currentTop = section.offsetTop + scrollContainer.offsetTop
        const currentBottom = currentTop + section.offsetHeight
        return scrollY >= currentTop && scrollY < currentBottom
      })
      setActiveSection(currentSectionIndex !== -1 ? currentSectionIndex : activeSection)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      const nextSectionIndex = Math.min(activeSection + 1, sectionElements.length - 1)
      scrollToSection(nextSectionIndex)
    } else if (event.key === 'ArrowUp') {
      const prevSectionIndex = Math.max(activeSection - 1, 0)
      scrollToSection(prevSectionIndex)
    }
  }

  const scrollToSection = (index: number) => {
    const scrollContainer = document.getElementById('scroll-container')
    sectionElements[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    })
    scrollContainer?.scrollTo({ top: sectionElements[index]?.offsetTop, behavior: 'smooth' })
    setActiveSection(index)
  }

  useEffect(() => {
    const scrollContainer = document.getElementById('scroll-container')
    scrollContainer?.addEventListener('scroll', onScroll)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      scrollContainer?.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [sectionElements, activeSection])

  return (
    <div className="group fixed right-3 top-1/2 z-50 flex -translate-y-1/2 transform flex-col md:right-6">
      {sectionElements.map((section, index) => {
        if (section.id === '') return null
        const isActive = activeSection === index
        const isHovered = hoveredSection === index
        return (
          <div key={index} className="relative mb-3 flex items-center md:mb-4">
            <button
              aria-label={`Go to ${section.id}`}
              className={`h-2.5 w-2.5 transform rounded-full shadow-[0_0_10px_rgba(247,212,106,0.35)] ring-1 ring-white/10 transition-all duration-200 hover:scale-125 md:h-3 md:w-3 md:shadow-[0_0_14px_rgba(125,211,252,0.35)] md:ring-2 md:hover:scale-150 ${
                isActive ? 'bg-gold' : 'bg-white/20 hover:bg-ice'
              }`}
              onPointerEnter={() => setHoveredSection(index)}
              onPointerLeave={() => setHoveredSection(null)}
              onClick={() => scrollToSection(index)}
            >
              <span
                className={`pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 transform whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-2 py-1 font-display text-xs tracking-wider text-moonlight backdrop-blur transition-opacity duration-200 md:mr-3 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {section.id.toUpperCase()}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ScrollIndicator
