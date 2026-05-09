import { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { vocBreakdown } from '../data/contaminants.js';
import { vocChannels } from '../data/vocList.js';

export default function VOCBreakdownSheet({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <div
      className={[
        'fixed inset-0 z-[100] transition-opacity duration-300',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />

      <div
        className={[
          'absolute inset-x-0 bottom-0 flex flex-col rounded-t-[2rem] bg-sand shadow-[0_-30px_60px_-30px_rgba(10,10,10,0.4)] transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ height: '92dvh' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voc-title"
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20" />

        <header className="flex items-center justify-between px-7 pt-5">
          <span className="font-serif text-base italic text-ink">Auracle</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink transition-colors hover:bg-ink hover:text-parchment"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-7 pt-6">
          <div className="mx-auto flex w-full max-w-md flex-col gap-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
              Detail · Contaminant
            </span>
            <h1
              id="voc-title"
              className="font-serif text-5xl font-light leading-[1.05] text-ink"
            >
              {vocBreakdown.title}
            </h1>
            <div className="h-px bg-hairline" />
            <p className="text-[15px] leading-[1.7] text-ink/85">
              {vocBreakdown.body}
            </p>

            <div className="mt-4 flex items-baseline justify-between">
              <h2 className="font-serif text-2xl italic text-ink">
                Channels Auracle reads
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
                {vocChannels.length} signals
              </span>
            </div>

            <ul className="flex flex-col">
              {vocChannels.map((c, idx) => (
                <li
                  key={c.formula}
                  className={[
                    'flex items-baseline justify-between gap-6 py-3.5',
                    idx < vocChannels.length - 1 ? 'border-b border-hairline' : '',
                  ].join(' ')}
                >
                  <span className="font-serif text-lg text-ink tabular-nums">
                    {c.formula}
                  </span>
                  <span
                    className={[
                      'text-right text-[11px] font-semibold uppercase tracking-[0.25em]',
                      c.aggregate ? 'text-ink' : 'text-graphite',
                    ].join(' ')}
                  >
                    {c.name}
                  </span>
                </li>
              ))}
            </ul>

            <p className="pt-2 text-xs italic leading-relaxed text-graphite">
              Aggregate VOC channel synthesises the field above into a single
              reading.
            </p>

            <div className="h-2" />
          </div>
        </div>

        <div
          className="px-7 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
        >
          <button
            type="button"
            className="group flex w-full items-center justify-between rounded-full bg-ink px-7 py-5 text-parchment transition-transform active:scale-[0.99]"
          >
            <span className="text-sm font-medium uppercase tracking-[0.25em]">
              {vocBreakdown.cta}
            </span>
            <Sparkles size={18} strokeWidth={1.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
