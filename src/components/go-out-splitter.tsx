import { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  QrCode,
  MessageCircle,
  UserPlus,
  Receipt,
  ArrowRight,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/lib/use-local-storage';
import type { CurrencyCode } from '@/lib/currency';
import { currencySymbol } from '@/lib/currency';

// ---------- helpers ----------
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const num = (s: string | number) => {
  const n = typeof s === 'number' ? s : parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- types ----------
type Person = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  price: string;
  paidBy: string; // person id
  sharedBy: string[]; // person ids
};

const DEFAULT_PEOPLE: Person[] = [
  { id: 'p-kishan', name: 'Kishan' },
  { id: 'p-kaustubh', name: 'Kaustubh' },
  { id: 'p-ankit', name: 'Ankit' },
  { id: 'p-rohan', name: 'Rohan' },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';

// deterministic tint per person id
const AVATAR_TINTS = [
  'bg-rose-500/20 text-rose-200 ring-rose-400/40',
  'bg-amber-500/20 text-amber-200 ring-amber-400/40',
  'bg-emerald-500/20 text-emerald-200 ring-emerald-400/40',
  'bg-sky-500/20 text-sky-200 ring-sky-400/40',
  'bg-violet-500/20 text-violet-200 ring-violet-400/40',
  'bg-pink-500/20 text-pink-200 ring-pink-400/40',
  'bg-lime-500/20 text-lime-200 ring-lime-400/40',
  'bg-cyan-500/20 text-cyan-200 ring-cyan-400/40',
];
const tintFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
};

// ---------- debt netting ----------
type Settlement = { from: string; to: string; amount: number };

function settle(balances: Record<string, number>): Settlement[] {
  const EPS = 0.01;
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];
  for (const [id, b] of Object.entries(balances)) {
    if (b < -EPS) debtors.push({ id, amt: -b });
    else if (b > EPS) creditors.push({ id, amt: b });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    out.push({ from: d.id, to: c.id, amount: round2(pay) });
    d.amt -= pay;
    c.amt -= pay;
    if (d.amt < EPS) i++;
    if (c.amt < EPS) j++;
  }
  return out;
}

// ============================================================
// Component
// ============================================================
export function GoOutSplitter({ currency }: { currency: CurrencyCode }) {
  const sym = currencySymbol(currency);

  const [people, setPeople] = useLocalStorage<Person[]>(
    'gos.people.v2',
    DEFAULT_PEOPLE,
  );
  const [items, setItems] = useState<Item[]>(() => [
    {
      id: uid(),
      name: '',
      price: '',
      paidBy: DEFAULT_PEOPLE[0].id,
      sharedBy: DEFAULT_PEOPLE.map((p) => p.id),
    },
  ]);
  const [gst, setGst] = useState('18');
  const [discount, setDiscount] = useState('');
  const [discountMode, setDiscountMode] = useState<'%' | 'flat'>('%');
  const [description, setDescription] = useState('');
  const [upiId, setUpiId] = useLocalStorage<string>('gos.upi.v1', '');

  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [selectedSettleIdx, setSelectedSettleIdx] = useState<number | null>(
    null,
  );

  // People ops
  const addPerson = () => {
    const n = people.length + 1;
    const p: Person = { id: uid(), name: `Person ${n}` };
    setPeople([...people, p]);
  };
  const removePerson = (id: string) => {
    if (people.length <= 1) return;
    setPeople(people.filter((p) => p.id !== id));
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        paidBy: it.paidBy === id ? people.find((p) => p.id !== id)!.id : it.paidBy,
        sharedBy: it.sharedBy.filter((s) => s !== id),
      })),
    );
  };
  const commitPersonName = (id: string) => {
    const name = editingPersonName.trim();
    setPeople(
      people.map((p) => (p.id === id ? { ...p, name: name || p.name } : p)),
    );
    setEditingPersonId(null);
    setEditingPersonName('');
  };

  // Item ops
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name: '',
        price: '',
        paidBy: people[0]?.id ?? '',
        sharedBy: people.map((p) => p.id),
      },
    ]);
  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));
  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const toggleShare = (id: string, pid: string) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const has = it.sharedBy.includes(pid);
        return {
          ...it,
          sharedBy: has
            ? it.sharedBy.filter((s) => s !== pid)
            : [...it.sharedBy, pid],
        };
      }),
    );

  // Calculation engine
  const calc = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + num(it.price), 0);
    const gstRate = num(gst);
    const disc = num(discount);
    const discountAmount =
      discountMode === '%' ? subtotal * (disc / 100) : Math.min(disc, subtotal);
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const multiplier =
      subtotal > 0
        ? (discountedSubtotal / subtotal) * (1 + gstRate / 100)
        : 0;
    const gstAmount = discountedSubtotal * (gstRate / 100);
    const finalTotal = discountedSubtotal + gstAmount;

    // per person balances
    const paid: Record<string, number> = {};
    const consumed: Record<string, number> = {};
    for (const p of people) {
      paid[p.id] = 0;
      consumed[p.id] = 0;
    }
    const itemFinals: { id: string; final: number; perShare: number }[] = [];
    for (const it of items) {
      const base = num(it.price);
      const finalPrice = base * multiplier;
      const sharers = it.sharedBy.filter((sid) => people.some((p) => p.id === sid));
      const perShare = sharers.length > 0 ? finalPrice / sharers.length : 0;
      if (paid[it.paidBy] !== undefined) paid[it.paidBy] += finalPrice;
      for (const s of sharers) consumed[s] = (consumed[s] ?? 0) + perShare;
      itemFinals.push({ id: it.id, final: finalPrice, perShare });
    }

    const balances: Record<string, number> = {};
    for (const p of people) {
      balances[p.id] = round2((paid[p.id] ?? 0) - (consumed[p.id] ?? 0));
    }
    const settlements = settle(balances);

    return {
      subtotal,
      discountAmount,
      gstAmount,
      finalTotal,
      multiplier,
      paid,
      consumed,
      balances,
      settlements,
      itemFinals,
    };
  }, [items, gst, discount, discountMode, people]);

  const hasResult = calc.finalTotal > 0;
  const personById = (id: string) => people.find((p) => p.id === id);

  // sharing text
  const eventLabel = description.trim() || 'our hangout';
  const dateStr = new Date().toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const shareText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`💸 ${eventLabel} — ${dateStr}`);
    lines.push('');
    lines.push('🧾 Items:');
    items.forEach((it, idx) => {
      const info = calc.itemFinals.find((f) => f.id === it.id);
      const nm = it.name.trim() || `Item ${idx + 1}`;
      const sharers = it.sharedBy
        .map((sid) => personById(sid)?.name)
        .filter(Boolean)
        .join(', ');
      lines.push(
        `• ${nm} — ${sym}${fmt(info?.final ?? 0)} · shared by ${sharers || '—'}`,
      );
    });
    lines.push('');
    lines.push(
      `Total ${sym}${fmt(calc.finalTotal)} (tax ${sym}${fmt(calc.gstAmount)}, discount ${sym}${fmt(calc.discountAmount)})`,
    );
    lines.push('');
    lines.push('👤 Consumption:');
    for (const p of people) {
      lines.push(`• ${p.name}: ${sym}${fmt(calc.consumed[p.id] ?? 0)}`);
    }
    lines.push('');
    lines.push('✅ Settle up:');
    if (calc.settlements.length === 0) {
      lines.push('All squared up!');
    } else {
      for (const s of calc.settlements) {
        lines.push(
          `• ${personById(s.from)?.name} → ${personById(s.to)?.name}: ${sym}${fmt(s.amount)}`,
        );
      }
    }
    if (upiId.trim()) {
      lines.push('');
      lines.push(`UPI: ${upiId.trim()}`);
    }
    return lines.join('\n');
  }, [items, people, calc, sym, eventLabel, dateStr, upiId]);

  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  // QR (for selected settlement)
  const activeSettlement =
    selectedSettleIdx !== null ? calc.settlements[selectedSettleIdx] : null;
  const activeReceiver = activeSettlement
    ? personById(activeSettlement.to)
    : null;
  const handle = upiId.trim();
  const qrPayload =
    activeSettlement && handle
      ? handle.startsWith('upi://') || handle.includes('@')
        ? `upi://pay?pa=${encodeURIComponent(handle.replace(/^upi:\/\/pay\?pa=/, ''))}&pn=${encodeURIComponent(activeReceiver?.name ?? '')}&am=${fmt(activeSettlement.amount)}&cu=${currency === 'INR' ? 'INR' : 'USD'}&tn=${encodeURIComponent(eventLabel)}`
        : `Pay ${activeReceiver?.name} ${sym}${fmt(activeSettlement.amount)} · ${handle}`
      : '';
  const qrUrl = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(qrPayload)}`
    : '';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-8 lg:items-start">
      {/* LEFT: Setup + Items */}
      <div className="space-y-5">
        {/* People */}
        <Section title="People" icon={<UserPlus className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => {
              const editing = editingPersonId === p.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 py-1 pl-1 pr-2 text-sm',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ring-1',
                      tintFor(p.id),
                    )}
                  >
                    {initials(p.name)}
                  </span>
                  {editing ? (
                    <>
                      <Input
                        autoFocus
                        value={editingPersonName}
                        onChange={(e) => setEditingPersonName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitPersonName(p.id);
                          if (e.key === 'Escape') {
                            setEditingPersonId(null);
                            setEditingPersonName('');
                          }
                        }}
                        className="h-7 w-28 rounded-lg px-2 text-sm"
                      />
                      <button
                        onClick={() => commitPersonName(p.id)}
                        className="grid h-6 w-6 place-items-center rounded-md hover:bg-secondary"
                        aria-label="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPersonId(p.id);
                          setEditingPersonName(p.name);
                        }}
                        className="max-w-[10rem] truncate font-medium"
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={() => {
                          setEditingPersonId(p.id);
                          setEditingPersonName(p.name);
                        }}
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removePerson(p.id)}
                        disabled={people.length <= 1}
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/20 hover:text-destructive disabled:opacity-30"
                        aria-label="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={addPerson}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add person
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Hangout description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dinner at Toit"
                className="h-12 rounded-xl border-border/60 bg-card px-3 text-sm"
              />
            </Field>
            <Field label="Your UPI ID (saved)">
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="you@upi"
                className="h-12 rounded-xl border-border/60 bg-card px-3 text-sm"
              />
            </Field>
          </div>
        </Section>

        {/* Global modifiers */}
        <Section title="Tax & discount">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="GST / Tax %">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
                <Input
                  inputMode="decimal"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  placeholder="18"
                  className="h-12 rounded-xl border-border/60 bg-card pl-7 pr-3 tabular-nums"
                />
              </div>
            </Field>
            <Field label="Discount">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {discountMode === '%' ? '%' : sym}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="h-12 rounded-xl border-border/60 bg-card pl-7 pr-3 tabular-nums"
                  />
                </div>
                <div className="flex h-12 shrink-0 items-center rounded-xl border border-border/60 bg-card p-1">
                  {(['%', 'flat'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDiscountMode(m)}
                      className={cn(
                        'h-full min-w-10 rounded-lg px-3 text-sm font-medium transition-colors',
                        discountMode === m
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {m === '%' ? '%' : sym}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>
        </Section>

        {/* Items */}
        <Section title="Items" icon={<Receipt className="h-4 w-4" />}>
          <div className="space-y-3">
            {items.map((it, idx) => {
              const info = calc.itemFinals.find((f) => f.id === it.id);
              return (
                <div
                  key={it.id}
                  className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-secondary text-[11px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <Input
                      value={it.name}
                      onChange={(e) =>
                        updateItem(it.id, { name: e.target.value })
                      }
                      placeholder={`Item ${idx + 1}`}
                      className="h-9 flex-1 rounded-lg border-transparent bg-transparent px-2 text-sm font-medium focus-visible:border-border/60 focus-visible:bg-background"
                    />
                    <button
                      onClick={() => removeItem(it.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {sym}
                      </span>
                      <Input
                        inputMode="decimal"
                        value={it.price}
                        onChange={(e) =>
                          updateItem(it.id, { price: e.target.value })
                        }
                        placeholder="0.00"
                        className="h-11 rounded-xl border-border/60 bg-background pl-7 pr-3 tabular-nums"
                      />
                    </div>
                    <Select
                      value={it.paidBy}
                      onValueChange={(v) => updateItem(it.id, { paidBy: v })}
                    >
                      <SelectTrigger className="!h-11 rounded-xl border-border/60 bg-background text-sm">
                        <SelectValue placeholder="Paid by" />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            Paid by {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Shared by
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(it.id, {
                            sharedBy:
                              it.sharedBy.length === people.length
                                ? [it.paidBy]
                                : people.map((p) => p.id),
                          })
                        }
                        className="text-[10px] font-medium uppercase tracking-wider text-primary hover:underline"
                      >
                        {it.sharedBy.length === people.length ? 'Only payer' : 'All'}
                      </button>
                    </div>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                      {people.map((p) => {
                        const active = it.sharedBy.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleShare(it.id, p.id)}
                            className={cn(
                              'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                              active
                                ? 'border-primary/40 bg-primary/15 text-foreground'
                                : 'border-border/50 bg-secondary/30 text-muted-foreground opacity-60 hover:opacity-100',
                            )}
                          >
                            <span
                              className={cn(
                                'grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ring-1',
                                tintFor(p.id),
                                !active && 'grayscale',
                              )}
                            >
                              {initials(p.name)}
                            </span>
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {info && info.final > 0 && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                      <span>
                        Final:{' '}
                        <span className="font-semibold tabular-nums text-foreground">
                          {sym}
                          {fmt(info.final)}
                        </span>
                      </span>
                      {it.sharedBy.length > 0 && (
                        <span>
                          Each:{' '}
                          <span className="font-semibold tabular-nums text-foreground">
                            {sym}
                            {fmt(info.perShare)}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addItem}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-transparent py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>
        </Section>
      </div>

      {/* RIGHT: Summary + Settlements */}
      <aside className="space-y-5 lg:sticky lg:top-32">
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Total bill
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-medium text-muted-foreground">
              {sym}
            </span>
            <span className="text-5xl font-bold tabular-nums tracking-tight">
              {fmt(calc.finalTotal)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Subtotal" value={`${sym}${fmt(calc.subtotal)}`} />
            <MiniStat
              label="Discount"
              value={`−${sym}${fmt(calc.discountAmount)}`}
            />
            <MiniStat label="Tax" value={`+${sym}${fmt(calc.gstAmount)}`} />
          </div>
        </section>

        <section className="rounded-3xl border border-border/60 bg-card p-5">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Per person
          </div>
          <div className="space-y-1.5">
            {people.map((p) => {
              const bal = calc.balances[p.id] ?? 0;
              const owes = bal < -0.01;
              const owed = bal > 0.01;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1',
                        tintFor(p.id),
                      )}
                    >
                      {initials(p.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Ate {sym}
                        {fmt(calc.consumed[p.id] ?? 0)} · Paid {sym}
                        {fmt(calc.paid[p.id] ?? 0)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                      owed && 'bg-emerald-500/15 text-emerald-300',
                      owes && 'bg-rose-500/15 text-rose-300',
                      !owed && !owes && 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {owed ? '+' : owes ? '−' : ''}
                    {sym}
                    {fmt(Math.abs(bal))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border/60 bg-card p-5">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Optimal settlements
          </div>
          {calc.settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasResult
                ? 'All squared up — nothing to settle.'
                : 'Add items to see who owes whom.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {calc.settlements.map((s, i) => {
                const from = personById(s.from);
                const to = personById(s.to);
                const active = selectedSettleIdx === i;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSettleIdx(active ? null : i)
                      }
                      className={cn(
                        'flex w-full items-center gap-2 rounded-2xl border p-2.5 text-left transition-colors',
                        active
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/50 bg-secondary/20 hover:bg-secondary/40',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1',
                          tintFor(s.from),
                        )}
                      >
                        {initials(from?.name ?? '')}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                        <span className="truncate font-medium">
                          {from?.name}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {to?.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1',
                          tintFor(s.to),
                        )}
                      >
                        {initials(to?.name ?? '')}
                      </span>
                      <span className="ml-1 shrink-0 rounded-full bg-background/60 px-2.5 py-1 text-xs font-semibold tabular-nums">
                        {sym}
                        {fmt(s.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {hasResult && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-semibold text-black shadow-sm transition-transform hover:brightness-110 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              Share via WhatsApp
            </a>
          )}
        </section>

        {activeSettlement && (
          <section className="rounded-3xl border border-border/60 bg-card p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <QrCode className="h-3.5 w-3.5" />
              Scan to pay {activeReceiver?.name}
            </div>
            {handle ? (
              <>
                <div className="mx-auto mt-4 grid aspect-square w-full max-w-[240px] place-items-center overflow-hidden rounded-2xl bg-white p-3">
                  <img
                    src={qrUrl}
                    alt={`QR code to pay ${activeReceiver?.name} ${sym}${fmt(activeSettlement.amount)}`}
                    width={240}
                    height={240}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Requesting{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {sym}
                    {fmt(activeSettlement.amount)}
                  </span>{' '}
                  · <span className="break-all">{handle}</span>
                </div>
              </>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Save your UPI ID above to generate a scannable QR for this
                settlement.
              </p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

// ---------- little UI atoms ----------
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/50 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/40 px-2 py-1.5">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}
