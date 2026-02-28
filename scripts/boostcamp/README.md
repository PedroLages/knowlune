# Boostcamp MHRP Program Automation

Automates entering the Masters Hypertrophy Return Protocol (MHRP) workout program into Boostcamp's web Program Creator using Playwright.

## Prerequisites

- Node.js 18+
- Playwright installed (`npm i` in project root)
- A Boostcamp account with the draft program already created
- Draft program named "MHRP Part 1" with 11 weeks

## Usage

```bash
npx tsx scripts/boostcamp/automate-part1.ts
```

The script will:

1. Open a Chrome browser window
2. Navigate to Boostcamp — **log in manually** (you have 2 minutes)
3. Find your "MHRP Part 1" draft program
4. Enter all exercises for each week automatically
5. Keep the browser open for review when done

## Configuration

Edit the `CONFIG` object in `automate-part1.ts`:

| Option | Default | Description |
|--------|---------|-------------|
| `startFromWeek` | `1` | Resume from a specific week |
| `onlyWeeks` | `[]` | Process only specific weeks (e.g., `[1, 5, 11]`) |
| `slowMo` | `50` | Delay between actions (ms) |
| `loginTimeout` | `120000` | Time to wait for manual login (ms) |
| `maxRetries` | `2` | Retries per exercise if entry fails |

## Resuming After Failure

If the script fails mid-way:

1. Note which week it stopped on (check console output)
2. Set `startFromWeek` to that week number
3. Re-run the script

## Files

| File | Purpose |
|------|---------|
| `part1-data.ts` | Workout data for all 11 weeks (types + exercises) |
| `automate-part1.ts` | Playwright automation script |
| `screenshots/` | Auto-captured screenshots (created on first run) |

## Verifying Data

Preview the workout data without running automation:

```bash
npx tsx scripts/boostcamp/part1-data.ts
```

## Notes

- The script enters exercises from scratch (copy-week optimization coming later)
- Exercise names are mapped to Boostcamp's database search terms
- Exercises not found in Boostcamp's database will use "Create New Exercise"
- Screenshots are saved on errors for debugging
