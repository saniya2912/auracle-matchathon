import { useState } from 'react';
import { ArrowUpRight, FlaskConical } from 'lucide-react';
import { rankedContaminants } from '../data/contaminants.js';
import VOCBreakdownSheet from '../components/VOCBreakdownSheet.jsx';

export default function VitalsView() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div
        className="h-full overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-9 px-7 pt-10">
          <Header />
          <ContaminantsSection
            items={rankedContaminants}
            onOpenVOC={() => setSheetOpen(true)}
          />
          <Footer />
        </div>
      </div>

      <VOCBreakdownSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-lg italic text-ink">Auracle</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink">
          Live
        </span>
      </div>

      <div className="h-px bg-hairline" />

      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
          Detected from sensors
        </span>
        <h1 className="font-serif text-6xl font-light leading-[1] text-ink">
          Vitals
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-graphite">
          A live ranking of contaminants Auracle suspects in your air, ordered by
          likelihood.
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-graphite">
          <span className="font-serif italic text-ink">VOCs</span> are invisible
          chemical gases released by everyday items. They can build up indoors
          and irritate your eyes, nose, and throat.
        </p>
      </div>
    </header>
  );
}

function ContaminantsSection({ items, onOpenVOC }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl italic text-ink">Contaminants</h2>
        <button
          type="button"
          onClick={onOpenVOC}
          className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-parchment transition-transform active:scale-[0.97]"
        >
          <FlaskConical size={14} strokeWidth={1.25} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">
            VOC Breakdown
          </span>
        </button>
      </div>

      <ol className="flex flex-col">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={[
              'flex items-center gap-5 py-5',
              idx < items.length - 1 ? 'border-b border-hairline' : '',
            ].join(' ')}
          >
            <span className="font-serif text-sm italic text-graphite">
              {String(idx + 1).padStart(2, '0')}
            </span>

            <div className="flex flex-1 flex-col">
              <span className="font-serif text-2xl font-light text-ink">
                {item.name}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-graphite">
                {item.source}
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-serif text-xl text-ink">
                {item.confidence}
                <span className="text-sm text-graphite">%</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-graphite">
                Likelihood
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Footer() {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
        Updated continuously
      </span>
      <span className="h-1.5 w-1.5 rounded-full border border-ink" />
    </div>
  );
}
