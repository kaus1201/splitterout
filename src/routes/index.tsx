import { createFileRoute } from '@tanstack/react-router';
import { Wallet, Users } from 'lucide-react';
import { useLocalStorage } from '@/lib/use-local-storage';
import { GoOutSplitter } from '@/components/go-out-splitter';
import { WalletTracker } from '@/components/wallet-tracker';
import type { CurrencyCode } from '@/lib/currency';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Go Out Splitter — Bill splitter & wallet' },
      {
        name: 'description',
        content:
          'Split restaurant bills with friends and track your personal spending in one sleek app.',
      },
    ],
  }),
  component: HomePage,
});

type Tab = 'wallet' | 'goout';

function HomePage() {
  const [tab, setTab] = useLocalStorage<Tab>('gos.tab', 'goout');
  const [currency, setCurrency] = useLocalStorage<CurrencyCode>(
    'gos.currency',
    'USD',
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="text-sm font-bold tracking-tight">
            Go Out<span className="text-muted-foreground">·</span>Splitter
          </div>
          <div className="flex items-center rounded-full border border-border/60 bg-card p-0.5">
            {(['USD', 'INR'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  currency === c
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={currency === c}
              >
                {c === 'USD' ? '$ USD' : '₹ INR'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto w-full max-w-md px-4 pb-3">
          <div className="grid grid-cols-2 rounded-2xl border border-border/60 bg-card p-1">
            <TabBtn
              active={tab === 'wallet'}
              onClick={() => setTab('wallet')}
              icon={<Wallet className="h-4 w-4" />}
              label="My Wallet"
            />
            <TabBtn
              active={tab === 'goout'}
              onClick={() => setTab('goout')}
              icon={<Users className="h-4 w-4" />}
              label="Go Out"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-5 pb-20 pt-6">
        <header className="mb-6">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {tab === 'wallet' ? 'Personal tracker' : 'Split the tab'}
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            {tab === 'wallet' ? 'My Wallet' : 'Go Out Splitter'}
          </h1>
        </header>

        <div
          key={tab}
          className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
        >
          {tab === 'wallet' ? (
            <WalletTracker currency={currency} />
          ) : (
            <GoOutSplitter currency={currency} />
          )}
        </div>
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
