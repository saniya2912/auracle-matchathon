import {
  Droplets,
  Flower,
  Fuel,
  Flame,
  PawPrint,
  Sparkle,
  Wind,
  ArrowRight,
} from 'lucide-react';

const ICONS = { Droplets, Flower, Fuel, Flame, PawPrint, Sparkle, Wind };

const TONE_LABEL = {
  good: 'Trace',
  moderate: 'Watch',
  bad: 'Elevated',
};

export default function IrritantCard({
  name,
  eyebrow,
  level,
  tone,
  icon,
  description,
  suggestions,
}) {
  const Icon = ICONS[icon] ?? Wind;

  return (
    <article className="overflow-hidden rounded-3xl bg-parchment/70 backdrop-blur-sm">
      <div className="flex items-start justify-between px-6 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink">
            <Icon size={18} strokeWidth={1.25} className="text-parchment" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
              {eyebrow}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-ink">
              {level} · {TONE_LABEL[tone]}
            </span>
          </div>
        </div>
      </div>

      <h3 className="px-6 pt-5 font-serif text-3xl font-light italic leading-tight text-ink">
        {name}
      </h3>

      <p className="px-6 pt-3 text-sm leading-relaxed text-graphite">
        {description}
      </p>

      <div className="mx-6 mt-6 h-px bg-hairline" />

      <div className="px-6 pb-6 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
          Actionable Suggestion
        </p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {suggestions.map((tip) => (
            <li key={tip} className="flex items-start gap-3">
              <ArrowRight
                size={14}
                strokeWidth={1.25}
                className="mt-0.5 shrink-0 text-ink"
              />
              <span className="text-sm leading-snug text-ink">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
