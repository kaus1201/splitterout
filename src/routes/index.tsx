import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Minus, Plus, ChevronDown } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Go Out Splitter — Instant bill splitter' },
      {
        name: 'description',
        content:
          'Split any restaurant bill with discount, GST and per-person share in real time.',
      },
    ],
  }),
  component: SplitterPage,
});

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const fmt = (n: number) =>
  (Number.isFinite(n) && n > 0 ? n : 0).toFixed(2);

function SplitterPage() {
  const [subtotal, setSubtotal] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountMode, setDiscountMode] = useState<'%' | '$'>('%');
  const [gst, setGst] = useState('18');
  const [people, setPeople] = useState(2);
  const [payer, setPayer] = useState('0');
  const [openBreakdown, setOpenBreakdown] = useState(true);

  const calc = useMemo(() => {
    const sub = num(subtotal);
    const disc = num(discount);
    const gstRate = num(gst);
    const discountAmount =
      discountMode === '%' ? sub * (disc / 100) : Math.min(disc, sub);
    const discountedSubtotal = Math.max(0, sub - discountAmount);
    const gstAmount = discountedSubtotal * (gstRate / 100);
    const finalTotal = discountedSubtotal + gstAmount;
    const perPerson = finalTotal / Math.max(1, people);
    return { sub, discountAmount, gstAmount, finalTotal, perPerson };
  }, [subtotal, discount, discountMode, gst, people]);

  const peopleList = Array.from({ length: people }, (_, i) => ({
    id: String(i),
    name: `Person ${String.fromCharCode(65 + i)}`,
  }));
  const payerIdx = Math.min(parseInt(payer, 10) || 0, people - 1);
  const payerName = peopleList[payerIdx]?.name ?? 'Person A';

  const setPeopleClamped = (n: number) => {
    const next = Math.max(2, Math.min(50, n));
    setPeople(next);
    if (parseInt(payer, 10) >= next) setPayer(String(next - 1));
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-16 pt-10">
        <header className="mb-8">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Split the tab
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Go Out Splitter
          </h1>
        </header>

        {/* Inputs */}
        <section className="space-y-5">
          <Field label="Subtotal">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                className="h-14 rounded-2xl border-border/60 bg-card pl-8 pr-4 text-lg tabular-nums"
              />
            </div>
          </Field>

          <Field label="Discount">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {discountMode === '%' ? '%' : '$'}
                </span>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-14 rounded-2xl border-border/60 bg-card pl-8 pr-4 text-lg tabular-nums"
                />
              </div>
              <div className="flex h-14 shrink-0 items-center rounded-2xl border border-border/60 bg-card p-1">
                {(['%', '$'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDiscountMode(m)}
                    className={cn(
                      'h-full min-w-11 rounded-xl px-4 text-sm font-medium transition-colors',
                      discountMode === m
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label="GST / Tax %">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
              <Input
                inputMode="decimal"
                placeholder="18"
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                className="h-14 rounded-2xl border-border/60 bg-card pl-8 pr-4 text-lg tabular-nums"
              />
            </div>
          </Field>

          <Field label="Number of people">
            <div className="flex h-14 items-center justify-between rounded-2xl border border-border/60 bg-card px-2">
              <StepperBtn
                onClick={() => setPeopleClamped(people - 1)}
                disabled={people <= 2}
                aria-label="Decrease people"
              >
                <Minus className="h-4 w-4" />
              </StepperBtn>
              <div className="flex flex-col items-center">
                <span className="text-lg font-semibold tabular-nums">
                  {people}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  people
                </span>
              </div>
              <StepperBtn
                onClick={() => setPeopleClamped(people + 1)}
                aria-label="Increase people"
              >
                <Plus className="h-4 w-4" />
              </StepperBtn>
            </div>
          </Field>

          <Field label="Who paid?">
            <Select value={String(payerIdx)} onValueChange={setPayer}>
              <SelectTrigger className="!h-14 rounded-2xl border-border/60 bg-card px-4 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {peopleList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </section>

        {/* Per-person result */}
        <section className="mt-8 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Per person
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-medium text-muted-foreground">
              $
            </span>
            <span className="text-5xl font-bold tabular-nums tracking-tight">
              {fmt(calc.perPerson)}
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Split {people} ways · Final ${fmt(calc.finalTotal)}
          </div>
        </section>

        {/* Breakdown */}
        <Collapsible
          open={openBreakdown}
          onOpenChange={setOpenBreakdown}
          className="mt-4 rounded-3xl border border-border/60 bg-card"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left">
            <span className="text-sm font-semibold">Bill breakdown</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                openBreakdown && 'rotate-180',
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-5 pb-5 pt-1 text-sm">
            <Row label="Original subtotal" value={`$${fmt(calc.sub)}`} />
            <Row
              label={`Discount ${
                discountMode === '%' && num(discount) > 0
                  ? `(${num(discount)}%)`
                  : ''
              }`}
              value={`− $${fmt(calc.discountAmount)}`}
              muted
            />
            <Row
              label={`GST (${num(gst)}%)`}
              value={`+ $${fmt(calc.gstAmount)}`}
              muted
            />
            <div className="my-2 h-px bg-border/60" />
            <Row
              label="Final bill total"
              value={`$${fmt(calc.finalTotal)}`}
              bold
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Settlement */}
        <section className="mt-4 rounded-3xl border border-border/60 bg-card p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Settlement
          </div>
          <p className="mt-2 text-base leading-snug">
            Everyone else owes{' '}
            <span className="font-semibold">{payerName}</span>{' '}
            <span className="font-semibold tabular-nums">
              ${fmt(calc.perPerson)}
            </span>{' '}
            each.
          </p>
        </section>
      </div>
    </main>
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
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function StepperBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11 rounded-xl bg-secondary/60 hover:bg-secondary disabled:opacity-30"
      {...props}
    >
      {children}
    </Button>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn(
          'text-muted-foreground',
          bold && 'font-semibold text-foreground',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          muted ? 'text-foreground/90' : 'font-semibold',
          bold && 'text-base',
        )}
      >
        {value}
      </span>
    </div>
  );
}
