# SEO Content Guide for hackwestern.com

Google ranks pages based on **visible text content**, not just meta tags. Right now, the homepage never mentions "Canada", "Western University", or "London, Ontario" in any text users can see. This guide tells you exactly what to change in each section to fix that.

**Target search queries we want to rank for:**
- "student hackathons in Canada"
- "hackathons in Ontario"
- "Western University hackathon"
- "Canadian student hackathon"
- "hackathons near me" (for Ontario students)
- "best hackathons for students Canada"

**Rule of thumb:** Every section should feel natural. Don't keyword-stuff. Just make sure the page actually says what it is and where it is.

---

## Hero Section
**File:** `src/components/promo/hero.tsx`

**Current text:**
- "NOV 21 - NOV 23, 2025"
- "The world is your canvas."
- "Thanks for coming! See you next year!"

**What's missing:** The hero never says what Hack Western is. Someone landing on this page (or a search engine) has to guess.

**Suggested addition:** Add a one-liner under the title or date that says something like:
> "Canada's largest student-run hackathon at Western University in London, Ontario."

This is the single highest-impact change for SEO. The `<h1>` area of your page carries the most weight with Google. Even a short subtitle line here does more than any meta tag.

---

## About Section
**File:** `src/components/promo/about/index.tsx`

**Current text:**
- Label: "About"
- Heading: "Create. Collaborate. Innovate."
- Speech bubble: "We cover food, travel, and lodging so you can focus on bringing your ideas to life!"
- Card: "Collaborate in teams of up to 4 to create tech projects, while participating in workshops, learning from mentors, competing for prizes, and meet like-minded hackers."

**What's missing:** No mention of what Hack Western actually is, who it's for, or where it takes place.

**Suggestions:**
1. Change the heading or add a sentence below it, something like:
   > "Hack Western is a 36-hour hackathon where students from across Canada come together to build, learn, and create."

2. The card text could naturally include location:
   > "Collaborate in teams of up to 4 to create tech projects at Western University in London, Ontario, while participating in workshops, learning from mentors, competing for prizes, and meeting like-minded hackers."

---

## Sponsors Section
**File:** `src/components/promo/sponsors.tsx`

**Current text:**
- "Our sponsors make Hack Western possible."
- "Thank you to the organizations that support our mission."
- Notepad: "SPONSOR A WEEKEND OF INSPIRATION AND CREATION."

**What's missing:** No mention of the event's scale or location.

**Suggestion:** Update the subtitle:
> "Thank you to the organizations that support one of Canada's largest student-run hackathons."

This is a small change that reinforces the "student-run hackathon in Canada" keyword naturally.

---

## Projects Section
**File:** `src/components/promo/projects/index.tsx`

**Current text:**
- Label: "past projects"
- Heading: "The world is waiting for your creation."
- Subtitle: "Here are what other students like you have created at Hack Western."

**This section is decent.** It mentions "students" and "Hack Western". One small improvement:
> "Here are what students from across Canada have created at Hack Western."

---

## FAQ Section
**File:** `src/constants/faq.ts` (the answers live here, not in the component)

**Current answers that could use location context:**

1. **"What is a hackathon?"** — Currently says "A hackathon is an event designed for students to experiment with tech and bring a project idea to life."
   **Suggestion:** "A hackathon is an event designed for students to experiment with tech and bring a project idea to life. Hack Western is one of Canada's largest, held annually at Western University in London, Ontario."

2. **"Who can participate?"** — Currently says "Hack Western applications are open to post-secondary students from across the world."
   **Good as-is**, but could add: "...from across the world. We welcome students from universities across Canada and beyond."

3. **"How much does it cost to attend Hack Western?"** — Currently says "Hack Western is completely free to attend..."
   **Suggestion:** "Hack Western is completely free to attend for all accepted students, including free food and swag! The event is held at Western University in London, Ontario. Participants travelling from outside of London and provided bus routes may incur additional costs."

4. **"When can I start hacking?"** — Mentions specific dates but not location.
   **Suggestion:** Add "at Western University" after mentioning the dates, e.g. "...November 21st, 2025 at Western University and ends at 9am on Sunday..."

Don't change every answer — 2-3 natural mentions of location across all FAQs is enough.

---

## Team Section
**File:** `src/components/promo/team/index.tsx` (title in `./title.tsx`)

**Current text:**
- "OUR TEAM"
- "Meet the team behind the event!"
- "We're here to help bring your ideas to life."

**Suggestion:** Update the subtitle:
> "Meet the Western University students who organize Canada's largest student-run hackathon."

This naturally ties the team to the university and reinforces the "student-run" keyword.

---

## Footer
**File:** `src/components/footer.tsx`

**Current text:** Just "MLH Code of Conduct" link.

**Suggestion:** Add a proper footer with:
- "Hack Western" name
- "Western University, London, Ontario, Canada"
- Social media links (Instagram, LinkedIn, etc.)
- "hello@hackwestern.com"

Footers appear on every page. A footer with your location means every indexed page carries that signal.

---

## Summary Checklist

| Section | Key change | Priority |
|---------|-----------|----------|
| **Hero** | Add subtitle: "Canada's largest student-run hackathon at Western University" | **Critical** |
| **About** | Mention what HW is + location in body text | High |
| **Sponsors** | "one of Canada's largest student-run hackathons" in subtitle | Medium |
| **Projects** | "students from across Canada" | Low |
| **FAQ** | Add location to 2-3 answers | Medium |
| **Team** | "Western University students" in subtitle | Medium |
| **Footer** | Add location, socials, email | High |

The hero subtitle and footer changes alone will make the biggest difference. Everything else compounds on top.
