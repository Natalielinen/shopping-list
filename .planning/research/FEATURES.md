# Feature Research

**Domain:** Personal shopping list / prioritized-purchase (wishlist) app with automatic multi-attribute priority scoring
**Researched:** 2026-07-26
**Confidence:** MEDIUM-HIGH (scoring rules are HIGH — source-of-truth in `SUMMARY.md`; competitive feature landscape is MEDIUM — from public app research)

## Context From Project

Core value (PROJECT.md): the user sees purchases **automatically sorted by a meaningful priority** so they know what to buy first. Success metric: the user **returns regularly and trusts the order**. That "trust" requirement is the north star for every scoring-UX decision below — a black-box number users don't understand will fail the metric even if the math is correct.

The differentiator is explicitly the **automatic priority scoring engine**: `total` = simple sum of point-bearing fields (category, urgency, need, benefit, deadlinePoints, doubts penalty, credit penalty). Scales are fixed in v1.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the product feel broken. Users give no credit for having them but abandon without them.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add item via form (title required) | Base function of any list app | LOW | Title is the only hard-required free-text field |
| Edit / delete item | Users mistype, change their mind | LOW | Standard CRUD |
| Mark item as bought (`completed`) → archive | Every grocery/todo app has "check off"; the satisfying core loop | LOW–MEDIUM | Bought items leave the active list; needs an archive store, not hard delete |
| "Show bought" filter (surface archived in main list) | Users want purchase history / to un-check mistakes | LOW | Toggle that unions archive into the active view |
| Default sorted view | A list app must render items in *some* deliberate order | LOW | Default = priority descending (this is the product's whole point) |
| Sort options: priority / date added / alphabetical | Users expect to re-order; competitors (My Shopping List, AnyList) all offer multiple sorts | LOW | All three are specified in requirements |
| Categories on items | Grocery apps universally categorize (Produce, Dairy…); here categories also feed scoring | LOW | Fixed enum in v1, doubles as a scoring input |
| Optional metadata: price, link, description | Wishlist/shopping users track cost and product links | LOW | Non-scoring fields; pure display/reference |
| Auth + per-user isolated lists | Product is multi-user; each user's data must be private | MEDIUM | Email/password; every list query scoped to user id |
| Mobile-first responsive UI | Shopping happens on a phone in a store/on the go | MEDIUM | Form with several dropdowns must stay thumb-friendly |

### Differentiators (Competitive Advantage)

Where this product competes. Mainstream shopping apps offer only crude low/med/high manual priority; almost none compute priority from multiple weighted signals.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic multi-attribute priority scoring engine** | The core differentiator — priority is *derived*, not manually guessed. No competitor combines category + urgency + need + benefit + deadline + doubts + credit into one score | HIGH | Pure, deterministic function of item fields. Must be well-tested (TDD) and centralized so score, sort, and badge all agree |
| **Score transparency / "why this priority" breakdown** | Directly serves the trust metric — showing the point contribution of each field makes the order believable and teaches users the model | MEDIUM | e.g. expandable breakdown: "Health +10, Very urgent +4, Deadline +12, Credit −2 = 24". Strongly recommended for v1 despite being optional |
| **Deadline-based urgency decay** (`deadlinePoints = 28 − days_to_deadline`, clamp [−100,100]) | Priority rises automatically as a deadline approaches — the list re-ranks itself over time with zero user effort | MEDIUM | Must be computed relative to *current date* at read/sort time, not frozen at creation. This is the one dynamic input |
| **Item dependencies / blocking** (`depends`: item is blocked until its prerequisite is bought) | Models real purchase sequencing (buy the printer before the ink). Rare outside project-management tools; novel in a shopping list | MEDIUM–HIGH | Blocked items should be visually distinct and likely sorted/grouped below active items regardless of raw score. Needs cycle prevention and orphan handling |
| **Priority badge with colour banding** | Turns the raw integer into a glanceable signal (high/med/low bands + colour + shape) | LOW–MEDIUM | Follow badge UX: colour alone is insufficient — pair with a number and/or shape/label for accessibility |
| **Doubts penalty & credit penalty** | Encodes buyer's-remorse and financing cost into the ranking — nudges impulse/credit purchases down | LOW | doubts: 0 / −1 / −3; isCredit: −2 and reveals `monthlyPayment` field |

### Anti-Features (Commonly Requested, Often Problematic)

Things that look attractive (competitors have them) but would dilute the core value or bloat v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Manual drag-to-reorder** | Todo/grocery apps commonly allow it | **Directly conflicts** with automatic scoring — if users can override order, the score becomes cosmetic and the differentiator dies | Keep order derived from score; if users want a different order, they change a scoring field (or use the alt sorts) |
| User-editable scales / weights (weighted sum) | Power users want to tune the model | Configurable scales + weights is real complexity and undermines predictability early; PROJECT lists it out of scope for v1 | Ship fixed, transparent simple-sum scales; revisit weighting in v2 once trust is established |
| Shared / collaborative lists | Families shop together | Multi-user sync, permissions, and conflict resolution are a large surface; out of scope per PROJECT | Single-user lists in v1; each person keeps their own |
| Push notifications / deadline reminders | Deadlines suggest reminders | Requires notification infra + scheduling; out of scope per PROJECT | The deadline already auto-raises priority in the list — the surfacing *is* the reminder |
| Price tracking / sale alerts | Wishlist apps (Giftful, Sortd) lead with this | External scraping/integrations, fragile, off-mission — this app ranks *what to buy*, not *when it's cheapest* | Store a static `price` for reference only |
| Barcode scanning / store-aisle sorting | Grocery apps (AnyList) do this | Optimizes in-store routing, not purchase prioritization — wrong problem for this product | Skip; categories already exist for scoring, not aisle mapping |
| Recurring items / list templates | Grocery staples repeat | Adds scheduling/state; not needed to validate the scoring concept | Manual re-add in v1 |
| Native mobile app | "It's a phone app" | Duplicate platform cost; mobile-first web covers the need per PROJECT | Responsive Next.js web app |

---

## Feature Dependencies

```
Auth (per-user isolation)
    └──requires──> Item CRUD (create/edit/delete, scoped to user)
                       └──requires──> Scoring engine (total = sum of point fields)
                                          ├──requires──> Priority-descending sort (default view)
                                          ├──requires──> Priority badge + breakdown UI
                                          └──enhanced-by──> Deadline field ──> deadlinePoints (time-relative)

Item CRUD
    ├──requires──> completed flag ──> Archive ──> "show bought" filter
    ├──requires──> isCredit flag ──> conditional monthlyPayment field
    └──requires──> depends field ──> Blocking logic (needs prerequisite's completed state)

Manual drag-to-reorder ──conflicts──> Automatic priority sort
User-editable weights ──conflicts──> Fixed transparent scales (v1)
```

### Dependency Notes

- **Scoring engine depends on Item CRUD + fixed scale definitions:** the engine is a pure function over item fields; the enum scales (Category/Urgency/Need/Benefit) and penalty rules must exist first. Centralize it — sort, badge, and breakdown must all read the *same* computation to stay consistent.
- **Priority sort depends on the scoring engine:** the default ordering is meaningless until `total` is computed. Build/verify the engine before wiring the sorted view.
- **deadlinePoints must be computed relative to "today," not stored at creation:** because it decays daily, freezing it would make the list stale. Compute on read/sort. This is the only non-static input and is the main reason ordering changes over time.
- **Blocking depends on both the `depends` reference and the prerequisite's `completed` state:** an item is blocked while its prerequisite is not yet bought. Requires referential integrity (prerequisite exists, same user), cycle prevention, and a rule for what happens if the prerequisite is deleted.
- **Archive depends on the `completed` flag; the "show bought" filter depends on the archive:** these three form one feature cluster and should be planned together.
- **`monthlyPayment` depends on `isCredit`:** field is only shown/relevant when isCredit is true (progressive disclosure in the form).
- **Manual reorder conflicts with automatic sort:** do not build both — manual override negates the differentiator.
- **Editable weights conflict with the v1 fixed-scale decision:** keep them out until the simple model is validated.

---

## MVP Definition

### Launch With (v1)

Everything needed to validate "users trust an auto-computed order." Maps 1:1 to PROJECT.md Active requirements.

- [ ] Auth (email/password) + per-user data isolation — without it, multi-user is impossible
- [ ] Item CRUD with title required; required dropdowns (category, urgency, need, benefit); optional fields (link, description, price, deadline, doubts, isCredit + monthlyPayment, depends)
- [ ] Scoring engine — `total` = simple sum of all point-bearing fields — the differentiator
- [ ] deadlinePoints formula with clamp [−100,100], computed relative to today
- [ ] Doubts penalty (0 / −1 / −3) and credit penalty (−2)
- [ ] Default view sorted by priority descending
- [ ] Sort filters: priority / date added / alphabetical
- [ ] Mark bought (`completed`) → archive; "show bought" filter
- [ ] Dependency blocking (`depends`): item locked until prerequisite bought
- [ ] Score presentation: at minimum a priority badge; **strongly recommend** the "why" breakdown for the trust metric
- [ ] Mobile-first responsive layout

### Add After Validation (v1.x)

- [ ] Score breakdown UI (if deferred from v1) — add once users ask "why is this ranked here?"
- [ ] Search / text filter within list — add when lists grow large enough to scroll
- [ ] Category filter (show only one category) — add when users have many items across categories
- [ ] Bulk actions (mark several bought) — add when the check-off loop feels tedious

### Future Consideration (v2+)

- [ ] User-configurable scales / weighted sum — defer until the fixed simple-sum model is trusted; adds real complexity
- [ ] Shared / collaborative lists — defer; large multi-user surface, explicitly out of scope now
- [ ] Deadline push notifications — defer; needs notification infra, and priority-raising already surfaces urgency
- [ ] Price tracking / sale alerts — defer; off-mission, fragile integrations
- [ ] Recurring items / templates — defer until repeat-purchase pain is proven

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Scoring engine (total) | HIGH | MEDIUM | P1 |
| Priority-descending default sort | HIGH | LOW | P1 |
| Item CRUD + required/optional fields | HIGH | MEDIUM | P1 |
| Auth + per-user isolation | HIGH | MEDIUM | P1 |
| Mark bought → archive + "show bought" | HIGH | LOW | P1 |
| deadlinePoints (time-relative) | HIGH | MEDIUM | P1 |
| Sort filters (added / alphabetical) | MEDIUM | LOW | P1 |
| Dependency blocking | MEDIUM | MEDIUM–HIGH | P1 (specified) |
| Priority badge (banded, accessible) | HIGH | LOW | P1 |
| Score "why" breakdown | HIGH | MEDIUM | P1–P2 (trust lever) |
| Search / category filter | MEDIUM | LOW | P2 |
| Configurable weights/scales | MEDIUM | HIGH | P3 |
| Shared lists | MEDIUM | HIGH | P3 |
| Price tracking / notifications | LOW | HIGH | P3 |

**Priority key:** P1 = must have for launch · P2 = should have, add when possible · P3 = future consideration

---

## Competitor Feature Analysis

| Feature | Grocery apps (AnyList, Listonic, My Shopping List) | Prioritization / PM tools (Todoist, Eisenhower apps, RICE/WSJF scorers) | Our Approach |
|---------|---------------|--------------|--------------|
| Priority | Manual low/med/high, swipe to change; sort by priority | Manual priority flags (Todoist P1–P4) or 2-axis Eisenhower quadrants | **Automatic numeric score** from 7 weighted inputs — no manual guessing |
| How priority is shown | Colour + icon per item | Quadrant position; coloured flags; some show numeric score badge with bands (0="don't do", 1–5 low, 6–12 med, 13–20 urgent) | Numeric badge with colour bands **plus optional per-field breakdown** for transparency |
| Weighted scoring | None | RICE/WSJF/weighted scorecards multiply criteria×weight, sum, rank | v1 uses **simple sum** (transparency over precision); weights are a v2 option |
| Deadline handling | Reminders / due dates | Due dates drive urgency axis | Deadline **auto-decays into points**, continuously re-ranking without reminders |
| Dependencies | None (grocery apps don't block items) | Task dependencies exist in PM tools (Asana/Jira), not consumer lists | **Blocking until prerequisite bought** — novel for a shopping list |
| Completed handling | Check off / cross out; "recently purchased" history | Mark done; archive/completed view | `completed` → archive, with "show bought" toggle to re-surface |
| Categories | Auto-categorize by aisle for store routing | Projects/labels | Categories are a **scoring input**, not aisle routing |

### Key UX insight on presenting computed priority

Research on score-badge UX and weighted scorecards converges on three rules that map directly to the trust metric:

1. **Band the raw number into labels + colour** (e.g. high / medium / low) so a glance conveys meaning, but keep the number visible for ordering fidelity.
2. **Never rely on colour alone** — pair colour with a numeric value and/or shape/label for accessibility.
3. **Expose the breakdown.** Because this app *computes* priority the user didn't set by hand, showing each field's point contribution is what converts "why is this here?" skepticism into trust. This is the single most important UX decision for the success metric.

---

## Sources

- Grocery/shopping apps: AnyList, Listonic, My Shopping List, Shopping Pro (App Store / Google Play / listonic.com) — manual priority, auto-sort, categories, check-off history
- Wishlist/budget apps: Wishli, Sortd, Giftful, Budget Shopping List — ranking by value, price tracking (noted as anti-feature)
- Prioritization frameworks & score presentation: Todoist Eisenhower, Ducalis (RICE/WSJF/Eisenhower), Community Health Toolkit priority-score buckets, Tempo weighted vs. unweighted scorecards, NN/g prioritization methods
- Badge UX: UX Movement "The Right Way to Design Table Status Badges" (colour + shape + label)
- Internal source of truth: `SUMMARY.md` (item schema, scales, deadlinePoints formula), `PROJECT.md` (scope, decisions, success metric)

---
*Feature research for: prioritized shopping list app*
*Researched: 2026-07-26*
