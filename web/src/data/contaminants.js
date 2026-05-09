export const rankedContaminants = [
  { id: 'mold', name: 'Mold', confidence: 78, source: 'mVOCs · humidity 64%' },
  { id: 'pollen', name: 'Pollen', confidence: 64, source: 'Tree pollen · outdoor drift' },
  { id: 'smoke', name: 'Smoke', confidence: 41, source: 'PM2.5 trend · 60mi NE' },
  { id: 'dust', name: 'Dust', confidence: 32, source: 'PM10 · indoor settling' },
  { id: 'vocs', name: 'VOCs', confidence: 18, source: 'Cleaning byproducts' },
];

export const vocBreakdown = {
  title: 'VOC Breakdown',
  body:
    'Volatile organic compounds (VOCs) in mould, often called microbial VOCs or mVOCs, are gases produced by active metabolism, growth, and decay, typically causing musty odors. Key compounds include alcohols, aldehydes, ketones, and sulfur compounds, such as 1-octen-3-ol, dimethyl disulfide, and formaldehyde. These compounds act as markers for hidden dampness and active fungal growth.',
  cta: 'Commence Olfactory Stimulation',
};
