export const initialMessages = [
  {
    id: 'm1',
    role: 'auracle',
    text: "Good morning. Air quality looks clean indoors, but pollen is spiking outside. Anything you'd like to know?",
  },
  {
    id: 'm2',
    role: 'user',
    text: 'My allergies are acting up today, what should I do?',
  },
  {
    id: 'm3',
    role: 'auracle',
    text:
      "I notice pollen levels are unusually high in your area this morning — about 3× the seasonal average for tree pollen. A few things that should help:\n\n• Keep windows shut until the afternoon breeze arrives.\n• Run your purifier on its highest setting for the next two hours.\n• Rinse your face and hands when you come back inside.\n\nWant me to set a reminder when conditions ease?",
  },
  {
    id: 'm4',
    role: 'user',
    text: 'Yes please, and tell me when it’s safe to go for a run.',
  },
];

export function mockReply(prompt) {
  const trimmed = prompt.trim().toLowerCase();
  if (!trimmed) return "I'm here whenever you're ready.";
  if (trimmed.includes('run') || trimmed.includes('outside')) {
    return "I'll watch the AQI and pollen drift. I'll ping you the moment levels look friendly for an outdoor run.";
  }
  if (trimmed.includes('purifier') || trimmed.includes('filter')) {
    return 'Your purifier is doing well — PM2.5 dropped 40% in the last hour. I can keep it on auto, or schedule a quiet mode for tonight.';
  }
  return "Got it. I'll factor that in alongside today's readings and follow up with anything actionable.";
}
