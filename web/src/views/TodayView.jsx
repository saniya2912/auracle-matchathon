import { Wind, Flower2, Cigarette, ArrowUpRight } from 'lucide-react';

const irritants = [
  { id: 'pollution', name: 'Pollution', reading: 'Low', Icon: Wind },
  { id: 'pollen', name: 'Pollen', reading: 'Moderate', Icon: Flower2 },
  { id: 'smoke', name: 'Smoke', reading: 'Trace', Icon: Cigarette },
];

export default function TodayView() {
  return (
    <div
      className="h-full overflow-y-auto"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-9 px-7 pt-10">
        <Header />
        <MetricBox />
        <IrritantList items={irritants} />
        <Footer />
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-lg italic text-ink">Auracle</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink">
          09 May
        </span>
      </div>

      <div className="h-px bg-hairline" />

      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
          Dispatch Nº 014
        </span>
        <h1 className="font-serif text-5xl font-light leading-[1.05] text-ink">
          The air,
          <br />
          refined.
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-graphite">
          A quiet read on what surrounds you, drawn from the sensors at your side.
        </p>
      </div>
    </header>
  );
}

function MetricBox() {
  return (
    <section className="rounded-3xl bg-ink p-7 text-parchment shadow-[0_24px_60px_-30px_rgba(10,10,10,0.6)]">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-parchment/70">
          Today's AQI
        </span>
        <span className="h-2 w-2 rounded-full border border-parchment/60" />
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <span className="font-serif text-[5.5rem] font-light leading-none">
          42
        </span>
        <span className="font-serif text-base italic text-parchment/70">
          / Excellent
        </span>
      </div>

      <div className="my-6 h-px bg-parchment/15" />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-parchment/70">
          San Francisco
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-parchment/70">
          Updated 9:41
        </span>
      </div>
    </section>
  );
}

function IrritantList({ items }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl italic text-ink">In your air</h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
          03 / 06
        </span>
      </div>

      <ul className="flex flex-col">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={[
              'flex items-center gap-5 py-4',
              idx < items.length - 1 ? 'border-b border-hairline' : '',
            ].join(' ')}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink">
              <item.Icon size={20} strokeWidth={1.25} className="text-parchment" />
            </div>

            <div className="flex flex-1 flex-col">
              <span className="font-serif text-lg text-ink">{item.name}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-graphite">
                {item.reading}
              </span>
            </div>

            <ArrowUpRight size={16} strokeWidth={1.25} className="text-ink" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Footer() {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
        Calibrated for you
      </span>
      <span className="h-1.5 w-1.5 rounded-full border border-ink" />
    </div>
  );
}
