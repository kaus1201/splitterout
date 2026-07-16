import { useState } from 'react';
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
      { title: 'Go Out Splitter — Split bills beautifully' },
      {
        name: 'description',
        content:
          'A premium bill splitter and personal wallet. Track shared expenses, calculate settlements, and share instantly.',
      },
    ],
  }),
  component: HomePage,
});

type Tab = 'wallet' | 'goout';

function HomePage() {
  const [tab, setTab] = useLocalStorage<Tab>('gos.tab', 'goout');
  const [currency, setCurrency] = useLocalStorage<CurrencyCode>('gos.currency', 'USD');

  return (
    <main
      className="relative min-h-screen bg-background text-foreground antialiased"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.045) 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* soft radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.06), transparent 60%)',
        }}
      />

      {/* Top nav */}
      <TopNav tab={tab} setTab={setTab} currency={currency} setCurrency={setCurrency} />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-10 md:px-10 md:pt-16">
        {/* Hero */}
        <header className="mb-10 md:mb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" />
            {tab === 'wallet' ? 'Personal tracker' : 'Group bill splitter'}
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            {tab === 'wallet' ? 'My Wallet.' : 'Go Out Splitter.'}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {tab === 'wallet'
              ? 'Log daily spending in seconds. Watch your day and month totals update instantly.'
              : 'Split expenses effortlessly with friends. Track payments, calculate settlements, and share the summary beautifully.'}
          </p>
        </header>

        <div key={tab} className="animate-in fade-in-50 slide-in-from-bottom-3 duration-500">
          {tab === 'wallet' ? (
            <div className="mx-auto w-full max-w-3xl">
              <WalletTracker currency={currency} />
            </div>
          ) : (
            <GoOutSplitter currency={currency} />
          )}
        </div>
      </div>
    </main>
  );
}

function TopNav({
  tab,
  setTab,
  currency,
  setCurrency,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  if (typeof window !== 'undefined') {
    window.addEventListener?.(
      'scroll',
      () => setScrolled(window.scrollY > 8),
      { passive: true, once: true },
    );
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-40 border-b border-transparent transition-all duration-300',
        scrolled && 'border-border bg-background/80 backdrop-blur-xl',
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-foreground text-background text-sm font-bold">
            G
          </div>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Go Out
          </span>
        </div>

        <div className="flex items-center rounded-full border border-border bg-card p-1 shadow-sm">
          <TabBtn
            active={tab === 'wallet'}
            onClick={() => setTab('wallet')}
            icon={<Wallet className="h-4 w-4" />}
            label="Wallet"
          />
          <TabBtn
            active={tab === 'goout'}
            onClick={() => setTab('goout')}
            icon={<Users className="h-4 w-4" />}
            label="Go Out"
          />
        </div>

        <div className="flex items-center rounded-full border border-border bg-card p-0.5 shadow-sm">
          {(['USD', 'INR'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                currency === c
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={currency === c}
            >
              {c === 'USD' ? '$' : '₹'}
            </button>
          ))}
        </div>
      </div>
    </div>
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
        'flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all',
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
