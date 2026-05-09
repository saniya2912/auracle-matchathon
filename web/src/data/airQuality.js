export const currentReading = {
  city: 'San Francisco',
  aqi: 42,
  updatedAt: 'Just now',
};

export function aqiCategory(aqi) {
  if (aqi <= 50) return { label: 'Excellent', tone: 'good', color: '#34d399' };
  if (aqi <= 100) return { label: 'Moderate', tone: 'moderate', color: '#fbbf24' };
  if (aqi <= 150) return { label: 'Sensitive', tone: 'moderate', color: '#fb923c' };
  if (aqi <= 200) return { label: 'Unhealthy', tone: 'bad', color: '#f87171' };
  if (aqi <= 300) return { label: 'Very Unhealthy', tone: 'bad', color: '#c084fc' };
  return { label: 'Hazardous', tone: 'bad', color: '#e11d48' };
}

export const toneStyles = {
  good: {
    dot: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]',
    text: 'text-emerald-300',
    label: 'Good',
  },
  moderate: {
    dot: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]',
    text: 'text-amber-300',
    label: 'Moderate',
  },
  bad: {
    dot: 'bg-rose-400 shadow-[0_0_12px_rgba(248,113,113,0.7)]',
    text: 'text-rose-300',
    label: 'Elevated',
  },
};

function classify(value, goodMax, moderateMax) {
  if (value <= goodMax) return 'good';
  if (value <= moderateMax) return 'moderate';
  return 'bad';
}

export const pollutants = [
  {
    id: 'pm25',
    name: 'PM2.5',
    description: 'Fine particulates',
    value: 8,
    unit: 'µg/m³',
    tone: classify(8, 12, 35),
  },
  {
    id: 'pm10',
    name: 'PM10',
    description: 'Coarse particulates',
    value: 22,
    unit: 'µg/m³',
    tone: classify(22, 54, 154),
  },
  {
    id: 'o3',
    name: 'Ozone',
    description: 'Ground-level O₃',
    value: 38,
    unit: 'ppb',
    tone: classify(38, 54, 70),
  },
  {
    id: 'no2',
    name: 'NO₂',
    description: 'Nitrogen dioxide',
    value: 14,
    unit: 'ppb',
    tone: classify(14, 53, 100),
  },
  {
    id: 'co2',
    name: 'CO₂',
    description: 'Indoor carbon dioxide',
    value: 920,
    unit: 'ppm',
    tone: classify(920, 800, 1200),
  },
  {
    id: 'voc',
    name: 'VOCs',
    description: 'Volatile organics',
    value: 0.42,
    unit: 'mg/m³',
    tone: classify(0.42, 0.3, 0.5),
  },
];
