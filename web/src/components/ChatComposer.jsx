import { useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ChatComposer({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !disabled;

  function submit(e) {
    e.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-full border border-ink/10 bg-parchment/70 px-2 py-1.5 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(10,10,10,0.15)]"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask Auracle…"
        className="flex-1 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className={[
          'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
          canSend ? 'bg-ink text-parchment' : 'bg-ink/15 text-ink/40',
        ].join(' ')}
      >
        <ArrowUp size={16} strokeWidth={1.75} />
      </button>
    </form>
  );
}
