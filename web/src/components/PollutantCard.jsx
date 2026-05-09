import { toneStyles } from '../data/airQuality.js';

export default function PollutantCard({ name, description, value, unit, tone }) {
  const style = toneStyles[tone];

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-5 py-4 backdrop-blur-md transition-colors hover:bg-white/[0.07]">
      <div className="flex items-center gap-4">
        <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-100">{name}</span>
          <span className="text-xs text-neutral-500">{description}</span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-2xl font-light text-neutral-50">
            {value}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            {unit}
          </span>
        </div>
        <span className={`text-[10px] uppercase tracking-[0.2em] ${style.text}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}
