# Seeding

## Migration vs Seed Data

**Migrations** define the database schema — tables, columns, indexes, enums.
They are additive, forward-only, and never destructive. They run via
`npm run db:migrate`.

**Seeds** populate platform-global reference data — plans, features, and
entitlements. They are idempotent and deterministic. They run via
`npm run db:seed`.

The distinction is critical: migrations change structure; seeds populate
content. A migration that inserts data is a code smell — data belongs in
seeds.

## Seeded Plans

| ID | Slug | Tier | Name | Max Websites | Custom Domains |
|----|------|------|------|--------------|----------------|
| `plan_free` | free | starter | Free | 1 | No |
| `plan_lifetime` | lifetime | business | Lifetime | unlimited | Yes |

## Seeded Features

| ID | Key | Category | Value Type |
|----|-----|----------|-----------|
| `feat_website_limit` | website_limit | limit | number |
| `feat_custom_domain` | custom_domain | capability | boolean |
| `feat_export_access` | export_access | capability | boolean |
| `feat_page_builder` | page_builder | capability | boolean |
| `feat_forms_access` | forms_access | capability | boolean |
| `feat_seo_access` | seo_access | capability | boolean |
| `feat_analytics_access` | analytics_access | capability | boolean |

## Idempotency

All seed inserts use `ON CONFLICT DO NOTHING` on the primary key. Rerunning
the seed does not create duplicates. Seed data changes must be explicit and
reviewable in the seed source file.

## No Customer-Specific Data

Seeds contain only platform-global reference data. No organization-specific
or customer-specific data is created. The LIFETIME plan is representable
for future lifetime-access grants, but no Tajon-specific data is seeded.

## Production Seeding

Production seeding is an explicit command, never automatic at application
startup:

```bash
npm run db:seed
```

Seed commands cannot accidentally delete production data — they only insert
with conflict resolution.
