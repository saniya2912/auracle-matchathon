export const irritants = [
  {
    id: 'mold',
    name: 'Mold',
    eyebrow: 'Detected indoors',
    level: 'Elevated',
    tone: 'bad',
    icon: 'Droplets',
    description:
      'Microscopic spores released by fungi growing in damp, poorly ventilated spaces. Can irritate the respiratory tract and trigger allergy-like symptoms.',
    suggestions: [
      'Run a dehumidifier to bring humidity below 50%.',
      'Inspect bathrooms and around windows for visible growth.',
      'Open interior doors to improve airflow between rooms.',
    ],
  },
  {
    id: 'pollen',
    name: 'Pollen',
    eyebrow: 'High outdoor count',
    level: 'High',
    tone: 'moderate',
    icon: 'Flower',
    description:
      'Tiny grains released by trees, grasses, and weeds. Counts spike on warm, breezy mornings and are a leading cause of seasonal allergies.',
    suggestions: [
      'Keep windows closed between 5am and 10am.',
      'Rinse face and hands after returning indoors.',
      'Switch on the air purifier with a HEPA filter.',
    ],
  },
  {
    id: 'petrol',
    name: 'Petrol & Exhaust',
    eyebrow: 'Nearby traffic',
    level: 'Moderate',
    tone: 'moderate',
    icon: 'Fuel',
    description:
      'Combustion byproducts from cars and small engines, including NO₂ and ultrafine particulates. Concentrations build up near busy roads and intersections.',
    suggestions: [
      'Avoid running outdoors along main roads today.',
      'If commuting by bike, choose side streets when possible.',
      'Set car ventilation to recirculate while in traffic.',
    ],
  },
  {
    id: 'smoke',
    name: 'Wildfire Smoke',
    eyebrow: 'Drift from 60mi NE',
    level: 'Trace',
    tone: 'good',
    icon: 'Flame',
    description:
      'Fine particles and gases from distant wildfires, carried by upper-atmosphere winds. Even trace levels can affect sensitive lungs.',
    suggestions: [
      'Normal outdoor activity is fine.',
      'Check evening AQI before long outdoor workouts.',
    ],
  },
  {
    id: 'dander',
    name: 'Pet Dander',
    eyebrow: 'Indoor allergen',
    level: 'Low',
    tone: 'good',
    icon: 'PawPrint',
    description:
      'Microscopic flakes of skin shed by furred animals. Lightweight enough to stay airborne for hours and settle on soft surfaces.',
    suggestions: [
      'Vacuum upholstered furniture once this week.',
      'Wash bedding in hot water if symptoms appear.',
    ],
  },
  {
    id: 'dust',
    name: 'Dust Mites',
    eyebrow: 'Indoor allergen',
    level: 'Moderate',
    tone: 'moderate',
    icon: 'Sparkle',
    description:
      'Microscopic creatures that thrive in mattresses, rugs, and upholstery. Their waste is a common trigger for asthma and rhinitis.',
    suggestions: [
      'Wash sheets weekly at 60°C or higher.',
      'Use allergen-proof covers on pillows and the mattress.',
      'Keep indoor humidity below 50%.',
    ],
  },
];

export const irritantTone = {
  good: { label: 'Trace', text: 'text-emerald-300', dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' },
  moderate: { label: 'Watch', text: 'text-amber-300', dot: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]' },
  bad: { label: 'Elevated', text: 'text-rose-300', dot: 'bg-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.7)]' },
};
