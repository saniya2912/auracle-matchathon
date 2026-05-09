import { useEffect, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage.jsx';
import ChatComposer from '../components/ChatComposer.jsx';
import { initialMessages, mockReply } from '../data/conversation.js';

export default function AskAuracleView() {
  const [messages, setMessages] = useState(initialMessages);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend(text) {
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const reply = {
        id: `a-${Date.now()}`,
        role: 'auracle',
        text: mockReply(text),
      };
      setMessages((prev) => [...prev, reply]);
    }, 650);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-7 pt-10 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-graphite">
          Ask Auracle
        </p>
        <h1 className="mt-2 font-serif text-4xl font-light italic text-ink">
          What's on your mind?
        </h1>
        <div className="mt-5 h-px bg-hairline" />
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-4">
          {messages.map((m) => (
            <ChatMessage key={m.id} role={m.role} text={m.text} />
          ))}
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-md px-5 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
      >
        <ChatComposer onSend={handleSend} />
      </div>
    </div>
  );
}
