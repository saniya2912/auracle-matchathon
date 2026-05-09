import { useState } from 'react';
import BottomNav from './components/BottomNav.jsx';
import AskAuracleView from './views/AskAuracleView.jsx';
import TodayView from './views/TodayView.jsx';
import VitalsView from './views/VitalsView.jsx';

const VIEWS = {
  ask: AskAuracleView,
  today: TodayView,
  vitals: VitalsView,
};

export default function App() {
  const [active, setActive] = useState('today');
  const ActiveView = VIEWS[active];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-sand text-ink">
      <main className="relative z-10 h-dvh">
        <ActiveView />
      </main>

      <BottomNav active={active} onChange={setActive} />
    </div>
  );
}
