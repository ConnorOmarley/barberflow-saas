# Features Research — BarberFlow

**Domain:** Barbershop scheduling and management SaaS (Brazil)
**Researched:** 2026-05-29
**Confidence:** MEDIUM — based on training knowledge of Booksy, Fresha, Vagaro, and Brazilian market through mid-2025. Web verification was unavailable; flag for manual spot-check before roadmap finalization.

---

## Table Stakes (Must Have)

Features customers expect from any scheduling SaaS. A barbershop owner evaluating options will reject a product that is missing any of these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Online booking portal | Core reason to buy — clients self-serve instead of calling | Medium | Must work mobile-first; most client bookings happen on phone |
| Real-time slot blocking | Without it, double-bookings destroy trust immediately | Medium | Requires live state; polling or websocket |
| Service catalog with duration + price | Owners cannot operate without this | Low | Duration drives slot math; price drives financial reports |
| Barber profiles + specialties | Clients book a person, not just a slot | Low | Photo, bio, which services each barber performs |
| Barber work schedule / availability | System must know when each barber is on shift | Medium | Per-barber working hours + exceptions (holidays, sick days) |
| Appointment status lifecycle | PENDING → CONFIRMED → COMPLETED → CANCELLED is industry standard | Low | Simple state machine; every competitor has it |
| Manual booking by owner/barber | Walk-ins and phone bookings still happen | Low | Panel-side booking creation by staff |
| Cancellation and rescheduling by client | Clients expect this; no-show protection requires cancellation window config | Medium | Configurable cutoff (e.g., "cancel up to 2h before") |
| Client notification at booking confirmation | SMS or WhatsApp confirmation is expected | Medium | In Brazil, WhatsApp >> SMS >> email |
| Appointment reminder before the visit | Reduces no-shows; every serious tool does this | Medium | Configurable timing (1 day before, 2 hours before) |
| Dashboard: today's schedule | Owner opens app and sees what's happening today | Low | Basic calendar/list view |
| Basic revenue report | Day/week/month totals; owners need this for cash flow awareness | Low | Sum of completed appointments × price |
| Multi-barber support | Virtually no barbershop has only one barber | Low | Filter calendar by barber |
| Client history per barber/shop | "Which client is this?" — owner looks up past visits | Low | Simple log; critical for personalization |
| Owner/barber role separation | Barbers should not see commission config or financial totals | Low | Two roles minimum |

---

## Differentiators

Features that are not universally present in competitors, or that are present but executed poorly. These create competitive moat when well-implemented.

| Feature | Value Proposition | Complexity | Present in Competitors? |
|---------|-------------------|------------|--------------------------|
| QR Check-In (auto presence) | Eliminates manual status updates; client scans QR on arrival and status flips to CHECKED_IN automatically | Medium | Not standard; Booksy has partial check-in flows but not QR-native |
| Digital loyalty stamp card | Configurable per shop (e.g., 10 cuts = 1 free); auto-stamp on service completion; client sees progress in portal | Medium | Fresha has "Passes" and loyalty points; Booksy has basic loyalty; Brazilian competitors mostly lack this |
| WhatsApp-native notifications | Brazil: 97% WhatsApp penetration. WhatsApp Business API for confirmations, reminders, and re-engagement beats email/SMS open rates by 3-5x | High | Booksy and Vagaro use email/SMS; WhatsApp integration is rare in this category |
| Re-engagement campaigns via WhatsApp | Automated "You haven't visited in 30 days" message to lapsed clients | High | Vagaro and Fresha have email campaigns; WhatsApp version is a Brazil-specific advantage |
| White label portal per shop | Owner's brand (logo, colors, custom domain) on the booking portal; client never sees "BarberFlow" | Medium | Fresha is always Fresha-branded; Booksy is always Booksy-branded; white label is a B2B2C advantage |
| PIX payment at booking | Native PIX checkout (primary Brazilian payment method, instant, zero MDR for individuals) | Medium | International tools (Booksy/Fresha) do not support PIX natively; Brazilian alternatives vary |
| Commission management per barber | Owner configures % or fixed value per service per barber; report shows who earns what | Medium | Vagaro has this; Booksy has basic payroll; Brazilian tools often lack it |
| Configurable cancellation window | Owner decides how late clients can cancel without penalty | Low | Most tools have this but it's under-communicated; a visible, owner-controlled setting is valued |
| Live "who is here now" dashboard | QR Check-In powers a real-time lobby view: who is waiting, who is being served | Medium | Not standard; valuable for busy multi-barber shops |
| Waitlist management | Client joins waitlist for a fully booked slot; auto-notified if opening appears | Medium | Booksy has waitlist; many Brazilian tools do not |
| Brazilian-Portuguese UX natively | Not translated — designed in PT-BR with BR-specific flows (CPF, PIX, WhatsApp) | Low (if built from scratch) | International tools have localization but UX still feels foreign |

---

## Anti-Features (Deliberately NOT Build)

Features to consciously exclude from the initial product, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Marketplace / discovery ("find a barbershop near me") | Completely different product. Requires SEO, geolocation search, review system, separate consumer brand. Adds months of scope with no direct revenue. | Keep each shop's portal private/white-labeled; marketplace is a separate product if ever |
| Inventory and product stock control | Barbershops sell products (pomades, etc.) but this is a separate operational domain. Adds significant complexity for a minority use case at MVP. | Out of scope per PROJECT.md; revisit post-PMF |
| POS hardware integration | Physical card terminals, receipt printers, cash drawer integration. High integration cost, hardware partnerships needed. | Accept PIX and card online; "pay at shop" option covers in-person without POS integration |
| Employee clock-in / timesheet | Labor management is an HR product, not a scheduling product. Overlap with QR Check-In creates confusion about purpose. | QR Check-In is client-facing for appointments, not employee HR time tracking |
| Reviews and ratings system | Requires moderation, owner response workflow, anti-fraud. Not a core scheduling value prop; can appear on Google Business instead. | Guide owners to Google Business Profile for reviews |
| Multi-location / franchise management | Enterprise feature. A 10-location chain needs a different product than a single barbershop. Premature complexity. | Each location = its own tenant; multi-location dashboard deferred until customers request it |
| Chat / messaging between client and barber | WhatsApp already owns this in Brazil. Building in-app chat that competes with WhatsApp is wasted effort. | WhatsApp deep link on booking confirmation; do not build competing chat |
| AI scheduling suggestions | Insufficient data at MVP to train meaningful models. Adds complexity for unproven value. | Standard availability-based booking first; AI deferred to post-validation phase |
| Franchise white-label app stores | Publishing custom-branded apps per tenant requires Apple/Google developer accounts per client, review processes, update complexity. | Mobile-responsive web app (PWA) covers 90% of the value; native app white label is post-scale |

---

## Competitor Analysis

### Booksy (International, present in Brazil)

**Positioning:** Marketplace + scheduling hybrid. Client discovers barbershop through Booksy marketplace, then books.

**Key features:**
- Online booking with real-time availability
- Automated reminders (email + SMS; WhatsApp not standard)
- Client messaging via in-app chat
- Staff schedule management
- Service catalog with prices
- Basic loyalty points (via "Boosts" marketing add-on)
- No-show protection (credit card hold)
- Marketing tools (email campaigns, Boost promotions)
- App for business (iOS + Android)
- Client app for discovery and booking

**What Booksy lacks for the Brazil market:**
- PIX integration
- WhatsApp-native notifications
- QR Check-In for auto presence
- Digital stamp loyalty card
- White label portal (always Booksy-branded)
- Commission management per barber

**Business model:** Freemium marketplace. Booksy makes money from the client-discovery side; business subscription is secondary. This creates tension: the shop's clients belong to Booksy, not the shop.

---

### Fresha (International, growing in Brazil)

**Positioning:** Free platform, monetizes on payment processing and premium features.

**Key features:**
- Online booking portal (always Fresha-branded)
- Real-time availability blocking
- Client notifications (email + SMS)
- Loyalty "Passes" (prepaid packages + points; more complex than stamp card)
- Memberships / subscription plans per client
- Payment processing (Stripe-based; no PIX)
- Team commission tracking (percentage-based)
- Inventory management
- Marketing campaigns (email)
- Reporting dashboard
- No-show protection

**What Fresha lacks for Brazil:**
- PIX payments
- WhatsApp notifications
- QR Check-In
- White label (always Fresha-branded)
- Portuguese-native UX (localized but not native)
- Simple stamp card (their loyalty is complex "Passes" — overkill for small barbershops)

**Business model:** Platform is free; charges 20% on voucher sales and processing fees. This creates lock-in and revenue friction that independent Brazilian SaaS can undercut.

---

### Vagaro (US-focused, minimal Brazil presence)

**Positioning:** Full-featured salon/spa/fitness management. Overkill for most barbershops.

**Key features:**
- Online booking
- POS integration (hardware)
- Payroll management
- Marketing emails
- Website builder
- Loyalty points program
- Membership plans
- Intake forms
- Reports and analytics
- Staff commission reports

**Relevance to Brazil:** Low direct competition due to pricing in USD, no PIX, no WhatsApp, US-centric UX.

---

### Brazilian Competitors (Regional)

**Trinks** (strong in salons and barbershops, Brazil)
- Online scheduling portal
- WhatsApp integration (confirmation messages)
- Financial reports
- Commission management
- Client history
- Loyalty program (basic points)
- Affordable BRL pricing

**Weak points:** UI is dated; no QR Check-In; loyalty card is points-based (not stamp card); WhatsApp is semi-manual (template-based, not fully automated); limited white label.

**Belasis** (scheduling-focused, Brazil)
- Online booking
- WhatsApp notifications
- Commission control
- Financial dashboard
- Client list

**Weak points:** No loyalty program; no QR Check-In; basic reporting; no white label.

**Simples Agenda / AgendaOnline** (generic, not barbershop-specific)
- Simple booking forms
- Email reminders
- No barbershop-specific features

**Key gap across all Brazilian competitors:** None offer the QR Check-In + automatic loyalty stamp card combo. WhatsApp integration exists but is semi-manual (requires WhatsApp Business app, not API). White label is limited.

---

## Typical Onboarding Flow for a New Barbershop

Based on how Booksy, Fresha, and Trinks structure onboarding:

1. **Sign up** — name, email, phone, shop name, address. Takes < 2 minutes.
2. **Add services** — prompted to create at least one service (name, duration, price). Most tools pre-populate with common services ("Haircut — 30min — R$50").
3. **Add barbers** — prompted to add at least one staff member (can be "owner as barber").
4. **Set working hours** — default Mon-Sat 9am-7pm; user adjusts per barber.
5. **Customize booking portal** — upload logo, set shop colors, configure booking rules (advance notice required, cancellation window).
6. **Share booking link** — given a link to share on WhatsApp, Instagram bio, Google Business. This is the "aha moment" — owner sends it to first real client.
7. **First booking arrives** — some tools send a congratulations notification for the first booking.

**Onboarding anti-patterns seen in competitors:**
- Requiring credit card before value is demonstrated (Vagaro)
- Too many mandatory fields before first booking link is generated
- No guided tour — owner left to discover features alone

**BarberFlow recommendation:** Reach "share your booking link" in under 5 minutes. The QR code and loyalty card setup can happen post-first-booking as progressive onboarding.

---

## Client Booking Experience (Typical Flow)

What clients experience across Booksy, Fresha, and Brazilian tools:

1. Client receives a link (from WhatsApp, Instagram, or Google)
2. Opens link on mobile browser (most common in Brazil)
3. Sees shop page: services, prices, barber list, photos
4. Selects service → selects barber (or "any available") → sees available time slots
5. Selects slot
6. Enters name, phone, optionally creates account
7. Confirms booking
8. Receives confirmation via WhatsApp (if integrated) or email
9. Day of: receives reminder
10. Arrives, gets served
11. Post-visit: (if loyalty exists) sees stamp progress

**Key UX observations:**
- Step 4 is where most abandonment happens — if no slots are visible, client leaves. Slot density matters.
- "Any available barber" option significantly increases booking conversion; many clients are loyal to the shop, not a specific barber.
- Mobile experience must be under 3 taps to reach available slots.
- Phone number is more trusted than email for Brazilian users; email feels foreign.

---

## Financial / Reporting Features Barbershop Owners Care About Most

Based on what Booksy, Vagaro, Fresha, and Trinks emphasize in their marketing and feature sets:

**Tier 1 — Owners look at this daily:**
- Today's revenue (completed appointments × price)
- Tomorrow's schedule (prep / staffing awareness)
- Commission owed to each barber this week

**Tier 2 — Owners look at this weekly:**
- Week-over-week revenue comparison
- No-show rate per barber
- Most popular services by revenue and volume
- Busiest hours / days (for scheduling optimization)

**Tier 3 — Owners look at this monthly:**
- Month total vs last month
- Per-barber productivity (appointments + revenue + commission)
- New vs returning clients
- CSV export for accountant

**Features owners say they want but rarely use:**
- Detailed client demographic analysis
- Marketing funnel metrics
- Predictive forecasting

**BarberFlow recommendation:** Build Tier 1 in MVP, Tier 2 in first growth phase, Tier 3 as export feature. Do not invest in dashboarding tools (charts, date-range pickers) before Tier 1 is solid.

---

## Feature Complexity Notes

Features that are harder to build than they appear at first glance.

### 1. Real-Time Slot Availability (Medium → High in practice)
Looks simple: "show free slots." In practice: concurrent bookings by multiple clients at the same time can cause race conditions where two clients see the same slot as free and both book it. Requires pessimistic locking or optimistic concurrency with retry on collision. Supabase row-level locks can handle this but the pattern must be explicit from day one.

### 2. WhatsApp Business API Integration (High)
The WhatsApp Business Cloud API (Meta) requires:
- Meta Business account verification
- Approved message templates (template approval can take days)
- Phone number linked per business (or per tenant if multi-tenant)
- Rate limits per 24-hour window
- Session vs template message distinction (template required for outbound; session for inbound replies)

In a multi-tenant model, the question is whether BarberFlow uses one WhatsApp Business number (limits personalization) or each tenant registers their own (harder UX). Most Brazilian B2B SaaS tools use a shared number with the shop name in the template. This is the correct starting approach.

### 3. PIX Payment at Booking (Medium)
PIX is instant but requires:
- Integration with a payment gateway that supports PIX (Asaas, PagSeguro, Mercado Pago — Asaas is already chosen for SaaS billing)
- QR code generation at checkout
- Webhook to confirm payment and mark booking as paid
- Expiry handling (PIX QR expires; if client doesn't pay in X minutes, slot is released)

The slot-hold-while-awaiting-payment flow is the tricky part. Must decide: hold the slot optimistically (risk: slot held but client never pays) or allow booking without payment (risk: no-shows).

### 4. QR Check-In Security (Low → Medium)
The QR code must encode a unique token per appointment (UUID or HMAC-signed token). If the QR is just the appointment ID, it can be faked. The token must be single-use or time-bounded. Also need to handle: what if client's phone battery died and they can't show QR? (Manual override by staff should always exist.)

### 5. Loyalty Stamp Card Edge Cases (Medium)
Edge cases that cause support tickets:
- Appointment completed, then cancelled retroactively — does the stamp get removed?
- Client disputes a missed stamp
- Reward redemption: what prevents double-redemption?
- What happens when the stamp rule changes mid-client-progress? (e.g., owner changes from 10 cuts to 12 cuts)

Needs explicit policies for each, encoded in the data model before launch.

### 6. Commission Reports with Multiple Barbers (Low → Medium)
Simple if commission is a flat percentage. Gets complex when:
- Different services have different commission rates per barber
- Owner provides products (pomade, etc.) as part of service — what's commissionable?
- Tip handling (cash tips are off-system; card tips need tracking)

For MVP: percentage per barber applied uniformly is sufficient. Per-service-per-barber commission rates can be Phase 2.

### 7. White Label Custom Domains (High)
Subdomain routing (barba.barberflow.com.br) is straightforward (DNS CNAME wildcard + tenant resolution by subdomain). Custom domains (cortelo.com.br pointing to BarberFlow) require:
- Owner to configure DNS CNAME
- TLS certificate provisioning per domain (Let's Encrypt via ACME protocol)
- Automatic cert renewal
- Fallback if cert provisioning fails

The TLS automation is the hard part. Tools like Caddy or Traefik handle this, but it adds infrastructure complexity. Consider offering subdomain-only in MVP, custom domain in a later tier.

### 8. App Mobile (Very High)
Native apps for two user types (owner + barber) × two platforms (iOS + Android) = effectively four separate apps. React Native or Flutter reduces this but still requires:
- App Store + Google Play accounts
- Review process (1-3 weeks for first submission)
- Push notification infrastructure
- Deep link handling for QR Check-In from camera app

The PROJECT.md correctly defers native apps. Mobile-responsive web (PWA with push notifications) covers 85% of the value and ships in days instead of months.

---

## Sources

Note: WebSearch and WebFetch tools were unavailable during this research session. All findings are based on training knowledge of these platforms through mid-2025. Confidence is MEDIUM. Manual verification against current Booksy, Fresha, Vagaro, Trinks, and Belasis marketing pages is recommended before roadmap finalization.

Key knowledge sources in training data:
- Booksy for Business feature documentation (booksy.com/blog)
- Fresha for Business feature pages (fresha.com/for-business)
- Vagaro Business feature overview (vagaro.com/business)
- Trinks feature documentation (trinks.com.br)
- WhatsApp Business Cloud API documentation (developers.facebook.com/docs/whatsapp)
- Meta WhatsApp template message policies
- PIX payment flow documentation (Banco Central do Brasil)
- Asaas payment API documentation (asaas.com/api)
