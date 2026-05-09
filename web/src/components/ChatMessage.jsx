import { Sparkles } from 'lucide-react';

export default function ChatMessage({ role, text }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-3xl rounded-tr-md bg-ink px-4 py-3 text-sm leading-relaxed text-parchment">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink">
        <Sparkles size={13} strokeWidth={1.5} className="text-parchment" />
      </div>

      <div className="max-w-[82%] rounded-3xl rounded-tl-md bg-parchment/70 px-4 py-3 text-sm leading-relaxed text-ink">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
