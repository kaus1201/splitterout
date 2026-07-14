import { useMemo, useState } from 'react';
import { CalendarIcon, Trash2, Plus } from 'lucide-react';
import { format, isSameDay, isSameMonth } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/use-local-storage';
import type { CurrencyCode } from '@/lib/currency';
import { currencySymbol } from '@/lib/currency';

type Category =
  | 'Food & Drinks'
  | 'Transport'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Others';

const CATEGORIES: Category[] = [
  'Food & Drinks',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Others',
];

const CATEGORY_STYLE: Record<Category, string> = {
  'Food & Drinks': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Transport: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Shopping: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  Bills: 'bg-red-500/15 text-red-300 border-red-500/30',
  Entertainment: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Others: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

type Expense = {
  id: string;
  title: string;
  category: Category;
  amount: number;
  date: string; // ISO
};

const fmt = (n: number) =>
  (Number.isFinite(n) && n > 0 ? n : 0).toFixed(2);

export function WalletTracker({ currency }: { currency: CurrencyCode }) {
  const sym = currencySymbol(currency);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>(
    'gos.wallet.expenses.v1',
    [],
  );

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('Food & Drinks');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);

  const now = new Date();
  const { today, month } = useMemo(() => {
    let today = 0;
    let month = 0;
    for (const e of expenses) {
      const d = new Date(e.date);
      if (isSameMonth(d, now)) month += e.amount;
      if (isSameDay(d, now)) today += e.amount;
    }
    return { today, month };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const sorted = useMemo(
    () =>
      [...expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [expenses],
  );

  const canSubmit = title.trim().length > 0 && parseFloat(amount) > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const item: Expense = {
      id: crypto.randomUUID(),
      title: title.trim(),
      category,
      amount: parseFloat(amount),
      date: date.toISOString(),
    };
    setExpenses((prev) => [item, ...prev]);
    setTitle('');
    setAmount('');
    setCategory('Food & Drinks');
    setDate(new Date());
  };

  const remove = (id: string) =>
    setExpenses((prev) => prev.filter((e) => e.id !== id));

  return (
    <div className="space-y-6">
      {/* Analytics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Spent today"
          value={`${sym}${fmt(today)}`}
          tint="from-primary/25 via-primary/10"
        />
        <MetricCard
          label="This month"
          value={`${sym}${fmt(month)}`}
          tint="from-emerald-500/25 via-emerald-500/10"
        />
      </div>

      {/* Add form */}
      <form
        onSubmit={submit}
        className="space-y-4 rounded-3xl border border-border/60 bg-card p-5"
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          New expense
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Title
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Coffee, bus ticket…"
            className="h-12 rounded-2xl border-border/60 bg-background"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <SelectTrigger className="!h-12 rounded-2xl border-border/60 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Amount
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                {sym}
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-12 rounded-2xl border-border/60 bg-background pl-8 tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Date
          </Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-start rounded-2xl border-border/60 bg-background font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    setDate(d);
                    setDateOpen(false);
                  }
                }}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-2xl text-base"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add expense
        </Button>
      </form>

      {/* History */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold">History</h2>
          <span className="text-xs text-muted-foreground">
            {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
            No expenses yet. Log your first one above.
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((e) => (
              <li
                key={e.id}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {e.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        CATEGORY_STYLE[e.category],
                      )}
                    >
                      {e.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(e.date), 'MMM d')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold tabular-nums">
                    {sym}
                    {fmt(e.amount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(e.id)}
                    aria-label={`Delete ${e.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border/60 bg-gradient-to-br to-transparent p-4',
        tint,
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}
