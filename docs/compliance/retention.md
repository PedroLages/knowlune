# Data Retention Matrix

[TODO: S10] — This document will be completed in E119-S10 (Retention Matrix & TTL Job).

It will define retention periods for all data categories processed by Knowlune,
lawful bases for retention, anonymisation/pseudonymisation rules for billing records,
and the enforcement schedule for the `retention-tick` job.

For now, the relevant code comments in `supabase/functions/_shared/hardDeleteUser.ts`
describe the lawful-basis exceptions inline (billing rows anonymised/retained for
tax purposes; breach-register references pseudonymised).
