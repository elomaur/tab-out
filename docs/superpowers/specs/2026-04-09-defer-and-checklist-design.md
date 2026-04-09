# Defer & Checklist — Design Spec

## Problem

People hoard tabs — especially long-form content like articles and videos — because closing feels like breaking a promise to their future selves. They experience loss aversion: the tab represents an intention ("I'll read this"), and closing it feels like abandoning that intention. They need **psychological safety** — a guarantee that closing a tab doesn't mean losing it.

## Solution

Add a "Save for Later" action to every tab. Deferred tabs close in the browser but appear in a persistent checklist column on the dashboard. Users work through the checklist at their own pace. Items they never get to gracefully age out into a searchable archive.

No AI summarization in this version. Just URLs, titles, and a satisfying checklist.

## Core Concepts

### Three Tab States

| State | Where it lives | How it gets here |
|-------|---------------|-----------------|
| **Open** | Browser + main dashboard area | Normal browsing |
| **Deferred** | Saved for Later checklist | User clicks save icon on a tab |
| **Archived** | Collapsed archive section | Checked off, dismissed, or aged out (30 days) |

### The Defer Action

- A bookmark/save icon appears on each individual tab chip (next to the existing X close button)
- A "Save all" button appears on each domain/mission card as a second button next to "Close all" (both buttons remain visible; they're distinct actions)
- Clicking either: closes the tab(s) in the browser and adds them to the checklist
- A subtle animation plays: the chip slides toward the Saved for Later column

### Data Stored Per Deferred Item

- `url` — the page URL
- `title` — the page title
- `favicon_url` — for visual recognition
- `deferred_at` — timestamp when saved
- `source_mission` — which mission/domain group it came from (optional, for context)
- `checked` — boolean, false by default
- `checked_at` — timestamp when checked off (null until then)
- `dismissed` — boolean, for items dismissed without reading

## Dashboard Layout

### Current Layout (unchanged)

- Header: greeting + date
- Most Visited section: top 8 domain tiles
- Main area: open tabs grouped by domain (or AI missions after organizing)
- Footer: stats + links

### New Addition: Saved for Later Column

Position: right side of the dashboard, alongside the main tab area. Always visible when it has items.

**Each checklist item shows:**
- Checkbox (unchecked by default)
- Favicon
- Page title (clickable — opens the URL in a new tab)
- Domain name in muted text
- Relative time since saved ("3 days ago")
- Small X button to dismiss without reading

**Visual behavior:**
- Unchecked items are full opacity, normal weight
- When checked: strikethrough on title, fade to lower opacity, then after ~1 second the item slides out and moves to archive
- Items are ordered by most recently deferred at the top

**Empty state:** "Nothing saved. Living in the moment."

**When hidden:** If the checklist is empty and the archive is empty, the column doesn't render at all — no wasted space.

### Archive Section

Position: below the checklist, collapsed by default.

- Toggle header: "Archive" with item count and expand/collapse chevron
- Simple list: title (clickable) + domain + date archived
- Searchable via a filter/search input when expanded
- Items live here indefinitely
- No delete action needed in v1 (keep it simple)

## User Flows

### Flow 1: Deferring a Single Tab

1. User sees a tab chip they want to save
2. Clicks the save/bookmark icon on the chip
3. Tab closes in the browser
4. Item appears at the top of the Saved for Later checklist
5. Subtle slide animation from the chip's position toward the column

### Flow 2: Deferring an Entire Mission/Domain

1. User clicks "Save all" on a domain or mission card
2. All tabs in that group close in the browser
3. All items appear in the checklist
4. The card animates out (same as current close behavior)

### Flow 3: Working Through the Checklist

1. User opens a new tab, sees the Saved for Later checklist
2. Clicks an item's title — opens in a new tab
3. Reads the content
4. Returns to dashboard (opens another new tab, or it's still in a tab)
5. Checks the checkbox
6. Item gets strikethrough + fades, then slides to archive

### Flow 4: Dismissing Without Reading

1. User clicks the X on a checklist item
2. Item moves directly to archive
3. No guilt — this is an explicit, supported action

### Flow 5: Aging Out

1. An item sits unchecked for 30 days
2. It quietly moves to the archive on the next dashboard load
3. No notification, no fanfare — it just retires

### Flow 6: Revisiting the Archive

1. User clicks "Archive" toggle to expand
2. Sees a searchable list of all past items
3. Can click any title to reopen it
4. Can use the search input to filter by title or domain

## Database Changes

### New Table: `deferred_tabs`

```sql
CREATE TABLE IF NOT EXISTS deferred_tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  favicon_url TEXT,
  source_mission TEXT,
  deferred_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT
);
```

### Archive Logic

An item becomes archived when any of these happen:
- `checked = 1` (user checked it off)
- `dismissed = 1` (user clicked X)
- `deferred_at` is more than 30 days ago (auto-age-out, processed on dashboard load)

When archiving, set `archived = 1` and `archived_at = datetime('now')`.

## API Endpoints

### `POST /api/defer`

Save one or more tabs for later.

Request body:
```json
{
  "tabs": [
    { "url": "...", "title": "...", "favicon_url": "...", "source_mission": "..." }
  ]
}
```

Response: `{ "success": true, "deferred": [...created items with ids...] }`

### `GET /api/deferred`

Fetch all deferred items (both active and archived). Also triggers the 30-day age-out check.

Response:
```json
{
  "active": [ ...items where archived = 0... ],
  "archived": [ ...items where archived = 1... ]
}
```

### `PATCH /api/deferred/:id`

Update a deferred item (check off or dismiss).

Request body:
```json
{ "checked": true }
```
or
```json
{ "dismissed": true }
```

Response: `{ "success": true, "item": { ...updated item... } }`

### `GET /api/deferred/search?q=query`

Search archived items by title or URL.

Response: `{ "results": [...matching archived items...] }`

## Visual Design

### Tab Chip Action Buttons (UX Improvement)

The existing close (X) button on tab chips is too small and only appears on hover. Both the close and the new save buttons need to be:
- **Always visible** — no hover required to reveal them
- **Larger hit target** — easy to click without precision aiming
- **Clearly spaced** — save icon on the left, close X on the right (or vice versa), with enough gap to avoid misclicks

### Save Icon

Use a bookmark or flag icon — something that signals "save" without being confused with "favorite" or "close." Should match the new larger button size.

### Checklist Column

- Same warm, papery aesthetic as the rest of the dashboard
- Card-style container with subtle border
- Checkboxes styled to match the existing design system (not browser defaults)
- Hover states on items for discoverability

### Animations

- **On defer:** tab chip slides/flies toward the Saved for Later column (subtle, ~300ms)
- **On check:** strikethrough appears, item fades to lower opacity, then slides down and out (~800ms total)
- **On dismiss:** item fades and slides out (~400ms)

### Responsive Behavior

- On wide screens: checklist column sits to the right of the main area
- On narrow screens: checklist section sits below the main area (stacked)

## Scope Boundaries

**In scope:**
- Defer action on tab chips and domain/mission cards
- Saved for Later checklist column
- Manual checking off
- Dismiss without reading
- 30-day auto-archive
- Searchable archive
- Animations for defer, check, dismiss

**Out of scope (future work):**
- AI-generated summaries for deferred/archived items
- Combo chain / escalating close animations
- Smart resurfacing based on topic similarity
- Reminders or notifications for stale items
- Sync across devices
