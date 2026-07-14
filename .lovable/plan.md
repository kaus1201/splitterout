
## Goal
Repurpose this project into a standalone mobile-first bill splitter called **Go Out Splitter**. Since the existing AssetWise scaffolding (auth, Supabase tables, dashboard, RBAC, AI chat) is unrelated to a calculator, we'll strip the app surface down to a single public route and reuse the design system tokens/typography inspiration (Onest font, warm-neutral or sleek dark) — you mentioned "in the same way taking inspo of the template", so I'll match its clean minimalist styling language, not its features.

## Design direction
- **Theme**: Sleek dark mode by default — near-black background, soft off-white text, single warm accent color for the highlighted "Per Person Share" and CTA affordances.
- **Typography**: Keep Onest (already loaded). Large tabular-nums display for money values, sentence case labels.
- **Layout**: Single centered column, max-width ~440px, generous vertical rhythm, 44px min touch targets, sticky result card on scroll for mobile.

## Screen structure (single route `/`)
```text
┌─────────────────────────────┐
│ Go Out Splitter             │  header
├─────────────────────────────┤
│ Subtotal        [$ 0.00  ]  │
│ Discount        [ 0   ][%|$]│  toggle pill
│ GST %           [ 18     ]  │
│ People          [ − ] 2 [+] │  stepper, min 2
│ Who paid?       [Person A▾] │  dropdown, options = P1..Pn
├─────────────────────────────┤
│  PER PERSON                 │  large accent card
│  $ 00.00                    │
├─────────────────────────────┤
│ Bill breakdown         [ ▾ ]│  collapsible
│  Subtotal          $ 0.00   │
│  Discount        − $ 0.00   │
│  GST (18%)       + $ 0.00   │
│  Final total       $ 0.00   │
├─────────────────────────────┤
│ Everyone else owes          │
│ Person A $X.XX each         │
└─────────────────────────────┘
```

## Calculation logic (pure function, runs on every input change)
1. `discountAmount = discountMode === '%' ? subtotal * (discount/100) : discount`
2. `discountedSubtotal = max(0, subtotal − discountAmount)`
3. `gstAmount = discountedSubtotal * (gst/100)`
4. `finalTotal = discountedSubtotal + gstAmount`
5. `perPerson = finalTotal / people`
- All displayed values pass through `format(n) = isFinite(n) && n > 0 ? n.toFixed(2) : "0.00"`.
- Inputs stored as strings; parsed with `parseFloat` fallback to 0. No NaN ever reaches the DOM.
- `people` clamped to integer ≥ 2. "Who paid" auto-clamps if people count shrinks below current selection.

## Files
- **Replace** `src/routes/index.tsx` — the entire splitter UI + state (single `useState` per field or one reducer object). Set head `title="Go Out Splitter"` + description + og tags.
- **Update** `src/routes/__root.tsx` — refresh default title/description to match the new app; keep `<Outlet />` intact.
- **Update** `src/styles.css` — add a sleek dark palette (background, surface, muted, accent) as `@theme inline` tokens if not already suitable; keep existing token names so shadcn components still work. Default to dark by adding `class="dark"` on `<html>` in root.
- **Reuse** shadcn `Input`, `Button`, `Label`, `Select`, `Collapsible`, `Switch` (or a segmented toggle built with two Buttons) from `src/components/ui/*`.
- **Leave untouched**: Supabase integration files, existing auth/dashboard routes (they simply become unreachable from the homepage). No backend changes, no migrations.

## Out of scope
- No persistence, no auth gating, no per-person itemization, no currency selector (uses `$` symbol only), no share/export. Say the word if you want any of these.

Ready to build on approval.
