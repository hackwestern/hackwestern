# Hack Western — Claude Context

## Stack

- Next.js 15 (App Router) + tRPC + Drizzle ORM + Postgres (Neon)
- Auth via NextAuth.js (OAuth: GitHub, Google, Discord + email/password)
- File storage via Cloudflare R2
- Email via Resend

## Database schema

Schema lives in `src/server/db/schema.ts`. Migration SQL files live in `drizzle/`.

### Tables

**`user`**
Central identity record. Created on first OAuth login.
- `id` varchar PK (NextAuth-generated)
- `type` enum: `hacker` | `organizer` | `sponsor`
- `scavengerHuntEarned` / `scavengerHuntBalance` — point tracking for scavenger hunt

**`application`**
One-to-one with `user` (userId is the PK). Stores a hacker's event application.
- `status` enum: `IN_PROGRESS` → `PENDING_REVIEW` → `IN_REVIEW` → `ACCEPTED` / `REJECTED` / `WAITLISTED` / `DECLINED`
- Avatar customisation fields (colour, face, hands, hat — integer indices into asset arrays)
- Personal info: name, age, phone, country, school, yearOfStudy, major
- Story: question1 / question2 / question3 (free text)
- Profile links: resume, github, linkedin, other
- MLH/CoC agreement booleans
- Optional demographics: underrepGroup, gender, ethnicity, sexualOrientation
- `canvasData` JSONB — freehand drawing canvas paths

**`review`**
Organizer review of a hacker application. Composite PK: `(reviewerUserId, applicantUserId)`.
- Ratings: `originalityRating`, `technicalityRating`, `passionRating` (smallint)
- `completed` boolean, `referral` boolean, free-text `comments`

**`preregistration`**
Email waitlist before applications open. Just `id` + `email` (unique) + `createdAt`.

**`account`** / **`session`** / **`verificationToken`** / **`resetPasswordToken`**
Standard NextAuth adapter tables. Don't touch directly — managed by next-auth.

**`scavengerHuntItem`**
Items that can be scanned at the event.
- `code` varchar(12) unique — what's encoded in the QR
- `points` smallint
- `deletedAt` — soft delete

**`scavengerHuntScan`**
Records a user scanning an item. Composite PK: `(userId, itemId)` — one scan per user per item.
- `scannerId` — the organizer/volunteer who facilitated the scan

**`scavengerHuntReward`**
Prizes purchasable with scavenger hunt points.
- `costPoints` smallint, `quantity` (nullable = unlimited)

**`scavengerHuntRedemption`**
Records a user redeeming a reward.

### Key relationships

```
user 1──1 application
application 1──* review
review *──1 user  (reviewer)
review *──1 user  (applicant)
user 1──* account (OAuth providers)
user 1──* scavengerHuntScan
user 1──* scavengerHuntRedemption
scavengerHuntScan *──1 scavengerHuntItem
scavengerHuntRedemption *──1 scavengerHuntReward
```

### Application status flow

```
IN_PROGRESS → PENDING_REVIEW → IN_REVIEW → ACCEPTED
                                          → REJECTED
                                          → WAITLISTED
                                          → DECLINED  (accepted but declined by hacker)
```

---

*Add new tables, enums, or relationship notes here as the schema evolves.*
