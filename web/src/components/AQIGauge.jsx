import { aqiCategory } from '../data/airQuality.js';

const SIZE = 260;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_AQI = 300;

export default function AQIGauge({ city, aqi, updatedAt }) {
  const category = aqiCategory(aqi);
  const progress = Math.min(aqi / MAX_AQI, 1);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">
        {city}
      </p>

      <div className="relative mt-6" style={{ width: SIZE, height: SIZE }}>
        <div
          className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${category.color}33 0%, transparent 70%)` }}
        />

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative -rotate-90"
        >
          <defs>
            <linearGradient id="aqiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={category.color} stopOpacity="1" />
              <stop offset="100%" stopColor={category.color} stopOpacity="0.4" />
            </linearGradient>
            <filter id="aqiGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />

          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#aqiGradient)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            filter="url(#aqiGlow)"
            style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">
            AQI
          </span>
          <span className="font-serif text-7xl font-light leading-none text-neutral-50">
            {aqi}
          </span>
          <span
            className="mt-2 font-serif text-base italic"
            style={{ color: category.color }}
          >
            {category.label}
          </span>
        </div>
      </div>

      <p className="mt-6 text-xs text-neutral-500">Updated {updatedAt}</p>
    </div>
  );
}
