---
name: Subscription tier authority
description: Where the authoritative subscription tier lives and how tiers/orbs are represented across the DB.
---

# Subscription tier authority

The authoritative subscription tier is NOT on the `users` table. It comes from the
`subscriptions` table, resolved via `getUserTier` → `checkSubscriptionExpiry` →
`storage.getSubscription(userId)` (see `server/lib/energy.ts`).

**Why:** Earlier code wrote `subscriptionTier`/`subscriptionEnd` to `users`, but those
columns do not exist — silent no-ops that never granted the tier.

**How to apply:** To grant/extend a subscription, create or update a `subscriptions`
row (`storage.createSubscription`/`updateSubscription`) with `tier`, `status`,
`currentPeriodEnd`. Mirror the YooKassa webhook pattern in `server/routes.ts`.

## Tier and orb representation gotchas
- `subscriptions.tier` enum is `standard | pro` (NOT premium). Map premium → `pro`
  for DB writes; `getUserTier` maps `pro`/`premium` → `premium` on read.
- `subscriptions.status` enum: `active | canceled | expired`.
- `users.subscriptionOrbs` is a **decimal string** defaulting to `"0"` (truthy!).
  Never test `!user.subscriptionOrbs`. Use `parseFloat(user.subscriptionOrbs ?? '0') <= 0`.
- Monthly orb amounts: `SUBSCRIPTION_MONTHLY_ORBS` keyed by `standard|premium`
  (250 / 550), written back as `.toString()`.

## Multi-step grants must be transactional
Claiming a referral reward + applying the subscription + granting orbs must run in a
single `db.transaction(tx)` (see `storage.claimReferralChoiceAtomic`).
**Why:** flipping a one-time reward record first and then applying benefits in
separate writes loses the reward permanently if a later write fails.
**How to apply:** conditional claim (`UPDATE ... WHERE reward_kind='pending_choice'
RETURNING *`) inside the same tx gives both race-safety (only one claimer wins) and
all-or-nothing integrity.
