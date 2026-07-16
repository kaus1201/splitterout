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
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  paidBy: string;
  sharedBy: string[];
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?';

// deterministic tint per person id (light theme friendly)
const AVATAR_TINTS = [
  'bg-rose-100 text-rose-700 ring-rose-200',
  'bg-amber-100 text-amber-800 ring-amber-200',
  'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'bg-sky-100 text-sky-700 ring-sky-200',
  'bg-violet-100 text-violet-700 ring-violet-200',
  'bg-pink-100 text-pink-700 ring-pink-200',
  'bg-lime-100 text-lime-800 ring-lime-200',
  'bg-cyan-100 text-cyan-700 ring-cyan-200',
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
export function GoOutSplitter({ currency }: { currency: CurrencyCode }) {
  const sym = currencySymbol(currency);

  const [people, setPeople] = useLocalStorage<Person[]>('gos.people.v3', []);
  const [items, setItems] = useState<Item[]>([]);
  const [gst, setGst] = useState('18');
  const [discount, setDiscount] = useState('');
  const [discountMode, setDiscountMode] = useState<'%' | 'flat'>('%');
  const [description, setDescription] = useState('');
  const [upiId, setUpiId] = useLocalStorage<string>('gos.upi.v1', '');

  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [selectedSettleIdx, setSelectedSettleIdx] = useState<number | null>(null);

  // ---- people ops ----
  const addPerson = () => {
    const p: Person = { id: uid(), name: `Person ${people.length + 1}` };
    setPeople([...people, p]);
    setEditingPersonId(p.id);
    setEditingPersonName(p.name);
    // Add them to existing items by default
    setItems((prev) =>
      prev.map((it) => ({ ...it, sharedBy: [...it.sharedBy, p.id] })),
    );
  };
  const removePerson = (id: string) => {
    const next = people.filter((p) => p.id !== id);
    setPeople(next);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        paidBy: it.paidBy === id ? next[0]?.id ?? '' : it.paidBy,
        sharedBy: it.sharedBy.filter((s) => s !== id),
      })),
    );
  };
  const commitPersonName = (id: string) => {
    const name = editingPersonName.trim();
    setPeople(people.map((p) => (p.id === id ? { ...p, name: name || p.name } : p)));
    setEditingPersonId(null);
    setEditingPersonName('');
  };

  // ---- item ops ----
  const addItem = () => {
    if (people.length === 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name: '',
        price: '',
        paidBy: people[0].id,
        sharedBy: people.map((p) => p.id),
      },
    ]);
  };
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
          sharedBy: has ? it.sharedBy.filter((s) => s !== pid) : [...it.sharedBy, pid],
        };
      }),
    );

  // ---- calculation ----
  const calc = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + num(it.price), 0);
    const gstRate = num(gst);
    const disc = num(discount);
    const discountAmount =
      discountMode === '%' ? subtotal * (disc / 100) : Math.min(disc, subtotal);
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const multiplier =
      subtotal > 0 ? (discountedSubtotal / subtotal) * (1 + gstRate / 100) : 0;
    const gstAmount = discountedSubtotal * (gstRate / 100);
    const finalTotal = discountedSubtotal + gstAmount;

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

  // ---- WhatsApp text (new format requested) ----
  const shareText = useMemo(() => {
    const place = description.trim() || 'Unnamed hangout';
    const lines: string[] = [];
    lines.push(`place: ${place}`);
    lines.push(`total bill: ${sym}${fmt(calc.finalTotal)}`);
    lines.push(`items consumed:`);
    if (items.length === 0) {
      lines.push(`  - (no items)`);
    } else {
      items.forEach((it, idx) => {
        const info = calc.itemFinals.find((f) => f.id === it.id);
        const nm = it.name.trim() || `Item ${idx + 1}`;
        lines.push(`  - ${nm}: ${sym}${fmt(info?.final ?? 0)}`);
      });
    }
    lines.push(`per person share:`);
    if (people.length === 0) {
      lines.push(`  - (no people)`);
    } else {
      for (const p of people) {
        lines.push(`  - ${p.name}: ${sym}${fmt(calc.consumed[p.id] ?? 0)}`);
      }
    }
    lines.push(`upi id: ${upiId.trim() || '-'}`);
    return lines.join('\n');
  }, [items, people, calc, sym, description, upiId]);

  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  // QR
  const activeSettlement =
    selectedSettleIdx !== null ? calc.settlements[selectedSettleIdx] : null;
  const activeReceiver = activeSettlement ? personById(activeSettlement.to) : null;
  const handle = upiId.trim();
  const qrPayload =
    activeSettlement && handle
      ? handle.startsWith('upi://') || handle.includes('@')
        ? `upi://pay?pa=${encodeURIComponent(handle.replace(/^upi:\/\/pay\?pa=/, ''))}&pn=${encodeURIComponent(activeReceiver?.name ?? '')}&am=${fmt(activeSettlement.amount)}&cu=${currency === 'INR' ? 'INR' : 'USD'}&tn=${encodeURIComponent(description.trim() || 'Split')}`
        : `Pay ${activeReceiver?.name} ${sym}${fmt(activeSettlement.amount)} · ${handle}`
      : '';
  const qrUrl = qrPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(qrPayload)}`
    : '';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      {/* ---------------- LEFT ---------------- */}
      <div className="space-y-8">
        {/* People */}
        <Card>
          <CardHeader
            eyebrow="Step 1"
            title="People"
            subtitle="Who's splitting the bill?"
            icon={<UserPlus className="h-4 w-4" />}
          />
          {people.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-6 py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">No people yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add participants to start splitting.
              </p>
              <button
                type="button"
                onClick={addPerson}
                className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Add first person
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const editing = editingPersonId === p.id;
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-sm shadow-sm transition-all hover:shadow-md"
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold ring-1',
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
                          className="h-8 w-32 rounded-lg px-2 text-sm"
                        />
                        <button
                          onClick={() => commitPersonName(p.id)}
                          className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary"
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
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removePerson(p.id)}
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
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
                className="flex h-10 items-center gap-1.5 rounded-full border border-dashed border-border bg-transparent px-4 text-sm text-muted-foreground transition-all hover:border-foreground/50 hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add person
              </button>
            </div>
          )}

          <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <Field label="Place / occasion">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dinner at Toit"
                className="h-12 rounded-xl border-border bg-background px-4 text-sm shadow-sm transition-shadow focus-visible:shadow-md"
              />
            </Field>
            <Field label="Your UPI ID (saved)">
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="you@upi"
                className="h-12 rounded-xl border-border bg-background px-4 text-sm shadow-sm transition-shadow focus-visible:shadow-md"
              />
            </Field>
          </div>
        </Card>

        {/* Tax & discount */}
        <Card>
          <CardHeader
            eyebrow="Step 2"
            title="Tax & discount"
            subtitle="Applied to the subtotal automatically."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GST / Tax %">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
                <Input
                  inputMode="decimal"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  placeholder="18"
                  className="h-12 rounded-xl border-border bg-background pl-8 pr-3 tabular-nums shadow-sm"
                />
              </div>
            </Field>
            <Field label="Discount">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {discountMode === '%' ? '%' : sym}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="h-12 rounded-xl border-border bg-background pl-8 pr-3 tabular-nums shadow-sm"
                  />
                </div>
                <div className="flex h-12 shrink-0 items-center rounded-xl border border-border bg-background p-1 shadow-sm">
                  {(['%', 'flat'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDiscountMode(m)}
                      className={cn(
                        'h-full min-w-10 rounded-lg px-3 text-sm font-medium transition-all',
                        discountMode === m
                          ? 'bg-foreground text-background shadow-sm'
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
        </Card>

        {/* Items */}
        <Card>
          <CardHeader
            eyebrow="Step 3"
            title="Items"
            subtitle="What did everyone order?"
            icon={<Receipt className="h-4 w-4" />}
          />
          {people.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-6 py-8 text-center text-sm text-muted-foreground">
              Add at least one person before adding items.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => {
                const info = calc.itemFinals.find((f) => f.id === it.id);
                return (
                  <div
                    key={it.id}
                    className="rounded-2xl border border-border bg-background p-4 shadow-sm transition-all hover:shadow-md animate-in fade-in-50 slide-in-from-top-1"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <Input
                        value={it.name}
                        onChange={(e) => updateItem(it.id, { name: e.target.value })}
                        placeholder={`Item ${idx + 1}`}
                        className="h-9 flex-1 rounded-lg border-transparent bg-transparent px-2 text-sm font-medium shadow-none focus-visible:border-border focus-visible:bg-secondary/50"
                      />
                      <button
                        onClick={() => removeItem(it.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {sym}
                        </span>
                        <Input
                          inputMode="decimal"
                          value={it.price}
                          onChange={(e) => updateItem(it.id, { price: e.target.value })}
                          placeholder="0.00"
                          className="h-11 rounded-xl border-border bg-card pl-8 pr-3 tabular-nums"
                        />
                      </div>
                      <Select
                        value={it.paidBy}
                        onValueChange={(v) => updateItem(it.id, { paidBy: v })}
                      >
                        <SelectTrigger className="!h-11 rounded-xl border-border bg-card text-sm">
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

                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/70 hover:text-foreground"
                        >
                          {it.sharedBy.length === people.length ? 'Only payer' : 'Everyone'}
                        </button>
                      </div>
                      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
                        {people.map((p) => {
                          const active = it.sharedBy.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleShare(it.id, p.id)}
                              className={cn(
                                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                                active
                                  ? 'border-foreground/80 bg-foreground text-background shadow-sm'
                                  : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                              )}
                            >
                              <span
                                className={cn(
                                  'grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ring-1',
                                  active ? 'bg-background text-foreground ring-background/60' : tintFor(p.id),
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
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
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
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-transparent py-4 text-sm font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* ---------------- RIGHT SIDEBAR ---------------- */}
      <aside className="space-y-5 lg:sticky lg:top-24">
        {/* Total */}
        <section className="rounded-3xl border border-border bg-foreground p-7 text-background shadow-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-background/60">
            Total bill
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-medium text-background/60">{sym}</span>
            <span className="text-5xl font-semibold tabular-nums tracking-tight md:text-6xl">
              {fmt(calc.finalTotal)}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-background/15 pt-4">
            <MiniStat label="Subtotal" value={`${sym}${fmt(calc.subtotal)}`} />
            <MiniStat label="Discount" value={`−${sym}${fmt(calc.discountAmount)}`} />
            <MiniStat label="Tax" value={`+${sym}${fmt(calc.gstAmount)}`} />
          </div>
        </section>

        {/* Per person */}
        {people.length > 0 && (
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Per person
            </div>
            <div className="space-y-1">
              {people.map((p) => {
                const bal = calc.balances[p.id] ?? 0;
                const owes = bal < -0.01;
                const owed = bal > 0.01;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-secondary"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1',
                          tintFor(p.id),
                        )}
                      >
                        {initials(p.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Ate {sym}
                          {fmt(calc.consumed[p.id] ?? 0)} · Paid {sym}
                          {fmt(calc.paid[p.id] ?? 0)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
                        owed && 'bg-emerald-100 text-emerald-700',
                        owes && 'bg-rose-100 text-rose-700',
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
        )}

        {/* Settlements */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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
                      onClick={() => setSelectedSettleIdx(active ? null : i)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-2xl border p-3 text-left transition-all',
                        active
                          ? 'border-foreground bg-secondary shadow-sm'
                          : 'border-border bg-background hover:border-foreground/30 hover:shadow-sm',
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1',
                          tintFor(s.from),
                        )}
                      >
                        {initials(from?.name ?? '')}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                        <span className="truncate font-medium">{from?.name}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{to?.name}</span>
                      </div>
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1',
                          tintFor(s.to),
                        )}
                      >
                        {initials(to?.name ?? '')}
                      </span>
                      <span className="ml-1 shrink-0 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold tabular-nums text-background">
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
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4" />
              Share via WhatsApp
            </a>
          )}
        </section>

        {activeSettlement && (
          <section className="rounded-3xl border border-border bg-card p-5 text-center shadow-sm animate-in fade-in-50 slide-in-from-bottom-2">
            <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <QrCode className="h-3.5 w-3.5" />
              Scan to pay {activeReceiver?.name}
            </div>
            {handle ? (
              <>
                <div className="mx-auto mt-4 grid aspect-square w-full max-w-[240px] place-items-center overflow-hidden rounded-2xl border border-border bg-white p-3">
                  <img
                    src={qrUrl}
                    alt={`QR to pay ${activeReceiver?.name} ${sym}${fmt(activeSettlement.amount)}`}
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
                Save your UPI ID above to generate a scannable QR.
              </p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

// ---------- atoms ----------
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
      {children}
    </section>
  );
}

function CardHeader({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {icon}
          {eyebrow}
        </div>
      )}
      <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-background/50">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-background">
        {value}
      </div>
    </div>
  );
}
