import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ footer = false }) {
  return (
    <Link
      className={`focus-ring inline-flex items-center gap-2.5 rounded-lg ${footer ? 'text-white' : 'text-ink'}`}
      to="/"
      aria-label="CareSync home"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-800 text-white">
        <Activity aria-hidden="true" size={19} strokeWidth={2.2} />
      </span>
      <span className="text-[1.2rem] font-extrabold tracking-[-0.045em]">
        Care<span className={footer ? 'text-teal-200' : 'text-teal-700'}>Sync</span>
      </span>
    </Link>
  );
}
