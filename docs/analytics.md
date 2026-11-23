# Analytics Engine events

Anonymous event counts are written to the Workers Analytics Engine dataset `enginecv_events` (binding `EVENTS`, see `wrangler.jsonc`) by `src/app/(site)/api/e/route.ts`. No cookie, IP, user agent or resume content is stored; every field is an allow-listed token.

Analytics Engine only has generic columns (`index1`, `blob1..blobN`, `double1..doubleN`), so what each one means is defined in **`src/lib/analytics/event-schema.ts`** (`EVENT_BLOB_LAYOUT`) and mirrored here. **Always filter on `blob1` first**: the same column means different things per event. New fields go at the end of a layout so old rows keep their meaning.

`double1` is always `1`. Analytics Engine samples at high volume, so count with `SUM(_sample_interval * double1)`.

## `export_completed`: a CV export finished

| Column | Meaning |
|---|---|
| `blob1` | `export_completed` |
| `blob2` | format (`pdf`, `docx`, `json`, ...) |
| `blob3` | source: referral slug, `utm_source` or referrer host; `direct` or `other` |
| `blob4` | country, 2 lowercase letters (`xx` unknown) |
| `blob5` | site locale (`en`, `de`, `bs`, `fr`, `es`, or `other`) |
| `blob6` | built-in template id (`default` if none) |
| `blob7` | landing page path (`/`, `/cv-examples/nurse`, `unknown`, `other`) |
| `blob8` | role example slug from the landing page, or `none` |
| `blob9` | `mobile`, `desktop` or `unknown` |

## `affiliate_click`: a click on a marked partner link

| Column | Meaning |
|---|---|
| `blob1` | `affiliate_click` |
| `blob2` | link id |
| `blob3` | source (as above) |

## `export_rating`: optional thumbs up/down after an export

Asked on the 2nd and 8th PDF/DOCX export unless answered or declined, and never when DNT/GPC is set.

| Column | Meaning |
|---|---|
| `blob1` | `export_rating` |
| `blob2` | `up` or `down` |
| `blob3` | format of the export being rated |
| `blob4` | source (as above) |
| `blob5` | country (as above) |

## `export_comment`: optional short text after a thumbs answer

Sent separately from `export_rating` (which is counted the moment the thumb is tapped), so **do not add comments to rating totals**. This is the only free-text field: capped at 280 characters, with emails, links and long digit runs replaced by `[removed]` server-side (`normalizeComment`). Treat it as potentially personal data and do not share raw rows.

| Column | Meaning |
|---|---|
| `blob1` | `export_comment` |
| `blob2` | `up` or `down` (the thumb it follows) |
| `blob3` | format of the export |
| `blob4` | source (as above) |
| `blob5` | country (as above) |
| `blob6` | the comment |

## Example queries

```sql
-- Exports per format, last 30 days
SELECT blob2 AS format, SUM(_sample_interval * double1) AS exports
FROM enginecv_events
WHERE blob1 = 'export_completed' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY format ORDER BY exports DESC

-- Thumbs up share per format
SELECT blob3 AS format,
       SUM(IF(blob2 = 'up', _sample_interval * double1, 0)) AS up,
       SUM(_sample_interval * double1) AS total
FROM enginecv_events
WHERE blob1 = 'export_rating'
GROUP BY format

-- Recent comments with their thumb
SELECT timestamp, blob2 AS rating, blob3 AS format, blob6 AS comment
FROM enginecv_events
WHERE blob1 = 'export_comment'
ORDER BY timestamp DESC LIMIT 50
```

## Privacy

Any new event or field must also be disclosed in section 2 of the privacy page (`src/app/(site)/privacy/page.tsx`).
