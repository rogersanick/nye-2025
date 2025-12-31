type StockTickerBannerProps = {
  message?: string
  className?: string
}

function TickerContent({ message, ariaHidden }: { message: string; ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden ? 'true' : undefined}
      className="flex shrink-0 items-center gap-6 pr-6"
    >
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.35em] text-gold/90 sm:text-[11px]">
        ▲
      </span>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80 sm:text-[11px]">
        {message}
      </span>
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.35em] text-ice/90 sm:text-[11px]">
        ●
      </span>
    </div>
  )
}

export default function StockTickerBanner({
  message = "New Year's goals. Get your New Year's goals in time for New Year's goals. New Year's goals. New Year's goals.",
  className = '',
}: StockTickerBannerProps) {
  return (
    <div
      className={[
        'ny-ticker fixed inset-x-0 top-0 z-[60] h-7 border-b border-white/10 bg-midnight/70 backdrop-blur-xl sm:h-8',
        className,
      ].join(' ')}
    >
      <div className="relative flex h-full items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:linear-gradient(90deg,rgba(247,212,106,0.10),rgba(125,211,252,0.10),rgba(167,139,250,0.10))]" />
        <div className="ny-ticker-mask relative w-full overflow-hidden">
          <div className="ny-ticker-track flex w-max items-center">
            <TickerContent message={message} />
            <TickerContent message={message} ariaHidden />
          </div>
        </div>
      </div>
    </div>
  )
}

