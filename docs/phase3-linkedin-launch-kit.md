# EssentialRegs — LinkedIn Launch Kit (Phase 3)

Written for Brody to copy, lightly edit, and send. Nothing here needs code
changes or a developer — it's just words to paste into LinkedIn, a video
recording, and outreach messages.

**How to use this doc**

- Everything in a fenced text box below is meant to be copied as-is. The few
  places you need to fill something in are marked `[like this]`.
- I've guessed your name as "Brody Kerr" for signatures (from your email
  address) — fix it if that's wrong, and add whatever title you want to use
  (Founder works fine at this stage).
- Post the 5 LinkedIn posts roughly 3-5 days apart, not all at once — spread
  them over 2-3 weeks so they don't read as a single promo blast.
- Every post and template below is honest about where the product actually
  is: pre-launch, first customers, one plan, real regulations already
  loaded. **Do not add customer quotes, user counts, or "customers love it"
  language beyond what's in these drafts** — there are zero paying customers
  today, and inventing that kind of proof is the fastest way to lose trust
  with exactly the compliance-minded audience you're selling to.
- The site's current $299/year price is a placeholder (see
  `src/lib/pricing.ts`) pending the pricing-validation calls in the outreach
  section below. None of the LinkedIn posts quote a specific price — that's
  intentional. If someone asks in a comment or DM, it's fine to say "we're
  still finalizing pricing with the first group of customers" and point them
  to a call.

---

## 1. LinkedIn posts

### Post 1 — Founder story ("why I built this")

```
I spent an afternoon last year doing something no one should have to do:
cross-referencing Colorado Regulation Number 7 against Regulation Number 3
by hand, flipping between two PDFs, trying to figure out which permitting
requirement actually applied to which emission point.

It wasn't complicated because the rules are unreasonable. It was
complicated because the rules are written as legal text, printed as flat
PDFs, and full of cross-references to other sections that you have to go
find yourself — every single time.

If you work in EHS or compliance at a Colorado oil & gas operator, you
already know this. You're not confused about the regulations. You're
just spending hours doing document navigation that a computer should be
doing for you.

So I built EssentialRegs: Colorado's oil & gas environmental and safety
regulations (CDPHE Regulation Number 3, Number 7, Number 26, and EPA's
methane rule for new and modified sources, 40 CFR Part 60 Subpart OOOOb)
loaded into one reader where every cross-reference is already resolved —
click one, and the section it points to pops up right there, no second
tab, no second PDF.

We also run every provision through an AI-drafted plain-English summary,
which a human reviews and approves before it ever goes live next to the
legal text.

It's early. We're working with our first handful of Colorado operators
right now. If this sounds like a problem you deal with, I'd genuinely
like to hear how your team handles it today — comment or DM me.
```

**Suggested visual:** a screenshot of the reader with a cross-reference
popup open (the `.xref` click-to-preview from the regulation page), or a
short screen-recording clip.

---

### Post 2 — The pain point

```
Every EHS professional at a Colorado oil & gas operator has done this:

You're reading Regulation Number 7 and it references a definition in
Regulation Number 3. So you open a second PDF. That section references a
third one. Now you have three PDFs open, two browser tabs, and you've
lost the thread of the actual question you were trying to answer.

None of that is because the regulations themselves are unreasonable —
it's because they were written as legal documents, not as something
meant to be read start to finish by the people who have to comply with
them day to day.

The cost of that isn't just wasted time. It's the real risk that
something gets missed because the cross-reference three sections deep
never got checked.

We built EssentialRegs to fix the format, not the rules: the same legal
text, fully cross-referenced, with click-to-preview citations so you can
check a reference without losing your place, plus a plain-English
summary next to the original language (never a replacement for it — the
full text is always right there too).

Currently covers CDPHE Regulation Number 3, Number 7, Number 26, and 40
CFR Part 60 Subpart OOOOb.

Curious how much of your week goes to this kind of document-hunting —
drop a comment, I'd like to know I'm not overestimating it.
```

**Suggested visual:** side-by-side mockup or screenshot — "three PDFs
open" vs. the single reader view.

---

### Post 3 — Product demo / feature walkthrough

```
A 90-second look at what EssentialRegs actually does (full video below,
but here's the short version):

1. Open any Colorado oil & gas regulation — right now that's CDPHE
   Regulation Number 3, Number 7, Number 26, and EPA's 40 CFR Part 60
   Subpart OOOOb — as one continuous, readable document instead of a
   flat PDF.

2. See a section that references another one? Click it. A popup shows
   you the referenced text right there, with a "go to full section" link
   if you want to jump to it directly. No new tab, no losing your place.

3. Next to the original legal language, read a plain-English summary —
   AI-drafted, then reviewed and approved by a person before it's shown
   to anyone. The original text is always right there next to it; the
   summary is a starting point, not a substitute.

4. Need something specific? Site-wide search finds it by ID or by text,
   from any page, in a couple keystrokes.

We're not trying to replace legal counsel or your compliance program.
We're trying to make the several hours a month your team spends
navigating dense regulatory text take minutes instead.

Free sample, no signup required: [essentialregs.com/sample link]
```

**Suggested visual:** the demo video from Section 2, or a short GIF/clip
of the click-to-preview interaction — that's the single most "oh, that's
useful" moment in the product.

---

### Post 4 — Honest early-access post (no fake social proof)

```
Full transparency: EssentialRegs doesn't have customers yet. It has a
finished product, real Colorado regulations loaded and cross-referenced
(CDPHE Regulation Number 3, Number 7, Number 26, and 40 CFR Part 60
Subpart OOOOb), and a free sample anyone can look at right now — but no
paying customers, and I'm not going to pretend otherwise.

What I'd rather do is be straight about that and open this up to the
first handful of Colorado operators willing to try it and tell me what's
wrong with it.

If you're in EHS or compliance at an operator and want to poke at the
real thing before anyone else does: essentialregs.com/sample has a full
sample entry, no account needed. If you want the full corpus and want to
help shape what this becomes, comment or send me a message — I'd rather
build this with the first ten people who actually use it than guess at
what they want from the outside.
```

**Suggested visual:** none needed — this one works as plain text; it
reads more honest without a polished graphic next to it.

---

### Post 5 — Direct ask (recruiting pricing-validation calls)

```
I'm looking for 5-10 people in EHS or compliance roles at Colorado oil &
gas operators for a 15-minute call — not a sales call, an honest
pricing-and-priorities conversation.

I've built EssentialRegs: Colorado's oil & gas environmental regulations
(CDPHE Regulation Number 3, Number 7, Number 26, and EPA's 40 CFR Part
60 Subpart OOOOb) with every cross-reference resolved and plain-English
summaries next to the original text. It's built. What I don't have yet
is confidence that I've priced it right or built the right things first
— and the only people who can tell me that are the people who'd
actually use it.

If that's you: comment, DM, or grab 15 minutes here [scheduling link] —
I'll show you the free sample either way, no obligation, no pitch.
```

**Suggested visual:** none — this is a direct ask, keep it plain text so
it reads like a real request, not an ad.

---

## 2. Demo video script (60-90 seconds)

Record this as a straight screen capture with voiceover — no need for
a camera, animation, or editing beyond basic cuts. Use the live site;
walk through `/sample` and a full regulation page if you have access.
Suggested pacing below assumes a calm, unhurried voiceover — don't rush
it to hit the time exactly, 75-90 seconds is fine.

```
[0:00-0:08] — SCENE: Screen starts on a stack of the actual PDF
regulations (CDPHE Reg 3 / Reg 7 open in a PDF viewer, if you want a
visual prop — otherwise just black screen with the line on it).
VOICEOVER: "If you work in EHS or compliance at a Colorado oil and gas
operator, this is what reading the regulations usually looks like."

[0:08-0:18] — SCENE: Cut to essentialregs.com homepage, then click into
/sample or a full regulation page.
VOICEOVER: "EssentialRegs takes the same regulations — Colorado's
Regulation Number 3, Number 7, Number 26, and EPA's methane rule for new
sources — and turns them into one readable document."

[0:18-0:40] — SCENE: Scroll the reader to a section containing a
cross-reference (a highlighted/linked citation). Click it — the popup
appears showing the referenced section's text.
VOICEOVER: "See a cross-reference? Click it. You get the referenced
section right here, in a popup — no second tab, no hunting through
another PDF to find out what it actually says."

[0:40-0:48] — SCENE: In the popup, click "Go to full section →" and show
the page scrolling to and highlighting that section.
VOICEOVER: "Need the full context? One click jumps you straight to it."

[0:48-1:05] — SCENE: Scroll to a provision that has a plain-English
summary panel showing next to the original legal text.
VOICEOVER: "Next to the original legal language, you get a plain-English
summary — drafted with AI, but reviewed and approved by a person before
it's ever shown. The original text is always right there. The summary
just gets you oriented faster."

[1:05-1:18] — SCENE: Click the search box in the header, type a keyword
or section number, show instant results.
VOICEOVER: "And if you already know what you're looking for, search
finds it instantly — by section number or by keyword — from anywhere on
the site."

[1:18-1:30] — SCENE: Cut back to homepage / pricing section, end on the
/sample link.
VOICEOVER: "EssentialRegs currently covers Colorado's core air-quality
regulations for oil and gas operators. There's a free sample at
essentialregs.com/sample — no signup required. Go take a look."
```

**Notes:**
- If you don't want to record your own voice, this script works fine
  read by any text-to-speech tool — the content is what matters, not
  polish, at this stage.
- Keep the cross-reference click-to-preview moment (0:18-0:48) — that's
  the single feature that makes people say "oh, I get it" the fastest.
  If you have to cut the video shorter, cut search before you cut that.

---

## 3. Outreach templates (goal: book a 15-minute call, not close a sale)

These are for the 5-10 pricing-validation calls in the phase plan. Each
one is written to get a "sure, 15 minutes" — not to sell the product on
the spot. Send the LinkedIn connection note and the email to different
people; don't send both to the same person unless the connection note
goes unanswered for a week or two.

### Template A — LinkedIn connection request note

LinkedIn caps connection notes at 300 characters, so keep this tight.

```
Hi [First Name] — I'm building a tool that cross-references Colorado's
oil & gas environmental regs (Reg 3/7/26, 40 CFR 60 OOOOb) so EHS teams
don't have to flip between PDFs. Would love to connect and get 15 min of
your honest feedback sometime.
```

### Template B — LinkedIn DM (after connection is accepted)

```
Hi [First Name], thanks for connecting.

Quick context: I built EssentialRegs, a tool that takes Colorado's oil &
gas environmental regulations — CDPHE Regulation Number 3, Number 7,
Number 26, and EPA's methane rule for new sources (40 CFR Part 60
Subpart OOOOb) — and puts them in one reader with every cross-reference
already resolved (click a citation, see the referenced section right
there) plus a plain-English summary next to the original text.

I'm not trying to sell you anything today — I'm trying to make sure I'm
building the right thing and pricing it sensibly before I do a wider
launch. Would you be open to a 15-minute call to give me honest feedback
on the product and what it'd actually be worth to your team? Happy to
work around your schedule.

If it's easier to just look first, there's a free sample with no signup
here: essentialregs.com/sample

Either way, appreciate you taking a look.

[Brody Kerr]
```

### Template C — Cold email

```
Subject: 15 min on how your team handles Colorado O&G compliance reading?

Hi [First Name],

I'm Brody Kerr, and I built EssentialRegs — a tool that takes Colorado's
oil & gas environmental regulations (CDPHE Regulation Number 3, Number
7, Number 26, and EPA's methane rule for new and modified sources, 40
CFR Part 60 Subpart OOOOb) and puts them into one reader where every
cross-reference is already resolved and each provision has a
plain-English summary next to the original legal text.

I'm reaching out to a handful of EHS and compliance people at Colorado
operators — not to sell anything, but to get honest feedback before a
wider launch: does this solve a real problem for your team, and what
would it actually be worth to you? Fifteen minutes would help me a lot.

If you'd rather look before you talk, there's a free sample with no
signup required: essentialregs.com/sample

Would [day/time] or [day/time] work for a quick call? Happy to find a
time that's better if not.

Thanks for considering it,
Brody Kerr
Founder, EssentialRegs
brodykerr95@gmail.com
```

**A few notes on using these:**

- Fill in `[First Name]` and, in Template C, two real time options before
  sending — a template with an actual scheduling ask converts better
  than "let me know when works."
- If someone takes the call, the goal is to learn their real budget
  range and priorities, not to pitch $299/year at them — that number is
  still a placeholder and these calls are how you replace it with a real
  one.
- None of these mention price. If a call taker asks directly, it's fine
  to say the current site shows an early placeholder figure and you're
  validating it with calls like this one.
