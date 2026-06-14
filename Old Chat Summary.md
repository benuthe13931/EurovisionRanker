Absolutely — here’s a continuation summary you can paste into a fresh chat.
---
## Eurovision Ranker Project Continuation Summary

I’m building a custom Eurovision ranking app called **ESC Ranker**. It is a Vite/TypeScript/Supabase app deployed on Vercel. The app already has year pages, song metadata from JSON files, ranking pages, comparison-based ranking, trivia, favorites, countries, and user login.

The main thing I’ve been working on lately is expanding the app from simple yearly rankings into a much more advanced Eurovision tracking/ranking/prediction system.
---
# Current App Structure / Concepts
The app has yearly JSON files under something like:

```text
src/data/years/
```

Each year file contains the Eurovision entries for that year: country, artist, song, preview video URL, compare/start timestamp, flag/emoji info, semi-final metadata, finalist status, etc.
There is also now a separate results data concept:
```text
src/data/results/
```

with files like:
```text
2018-results.json
```

The point is:
```text
year JSON files = entry/song metadata
results JSON files = official placements, points, jury/televote metadata, timestamps
```

I do **not** want official results mixed into the year JSON files.
---
# Major Feature Area 1: Year Ranking Tabs
Each year page now has ranking modes/tabs.

For years before semifinals:
```text
Overall
```

For 2004–2007:
```text
Overall
Semi-Final
Grand Final
```

For 2008 onward:
```text
Overall
Semi-Final 1
Semi-Final 2
Grand Final
```

Grand Final views can reveal qualifiers/non-qualifiers, so they should have spoiler warnings.
Each ranking should be independent. Semi ranking, final ranking, and overall ranking are not automatically the same.
---
# Major Feature Area 2: Predictions
The app now has a Predictions section per year.

Already implemented or mostly implemented:
```text
Semi-Final 1 qualifier prediction
Semi-Final 2 qualifier prediction
Grand Final placement prediction
```

Qualifier predictions allow selecting the 10 countries expected to qualify. There is a reveal flow that reveals qualifiers one-by-one, with correctness highlighting.
Grand Final placement predictions allow arranging finalists in the predicted final order, then locking the prediction.

Important distinction:
```text
Rankings = what I personally like
Predictions = what I think Eurovision/Europe will do
```

These must remain separate.
---
# Grand Final Prediction Reveal Modes
After locking Grand Final placement predictions, the app should ask how to reveal the official results.

Reveal modes:
```text
Instant Results
Step-by-Step Reveal
Eurovision Results Night
```

There was a UX bug/concern:
After choosing a reveal mode, the app should not trap me in that mode forever. The back button should return to the reveal mode selection/config screen, not the main year page. Prediction locked state and reveal mode/config state should be separate.

Desired flow:
```text
Lock Prediction
→ Choose Reveal Mode
→ Begin Reveal
→ Back
→ Reveal Mode Selection
```

The prediction can remain locked; I can still choose a different reveal mode or reset/restart the reveal.
---
# Eurovision Results Night
This is the big cinematic feature.
The goal is to recreate Eurovision voting/results night.
The scoreboard should be the primary focus.
The scoreboard should remain visible at all times. Do **not** switch to separate announcement screens. The video, if present, is supplemental and should sit above/next to the scoreboard, not replace it.
---
## Results Data Structure

We settled on this general idea:
```json
{
  "year": 2018,
  "livestreamUrl": "",

  "televote": {
    "url": "",
    "beginTimestamp": null,
    "endTimestamp": null
  },

  "countries": [
    {
      "country": "Israel",
      "placement": 1,
      "totalPoints": 529,
      "juryPoints": 212,
      "televotePoints": 317,

      "jury": {
        "delegationStartTime": null,
        "twelvePointAnnouncementStartTime": null,
        "twelvePointTimestamp": null,
        "delegationEndTime": null,
        "votesAwarded": [
          {
            "country": "Cyprus",
            "points": 12
          }
        ]
      },

      "pointsAnnouncedAt": null
    }
  ]
}
```

Important details:
* No separate `placements` array if each country object already has `placement`.
* No `resultsAvailable` boolean; if result file/data exists, results exist.
* Jury metadata is country/delegation-specific.
* Televote video metadata is contest-level because televote is one continuous segment.
* Each country has `pointsAnnouncedAt`, which is the timestamp inside the continuous televote video where that country’s televote points are announced.
* `pointsAnnouncedAt` is **not** a clip start/end time.
---
# Eurovision Results Night: Non-Video Jury Animation
For non-video mode, all jury awarded points should use the same local scoreboard animation, including 12 points.
The special big center-screen `+12` animation is **only** for video mode.

Non-video jury flow:
A voting delegation awards:
```text
1, 2, 3, 4, 5, 6, 7, 8, 10, 12
```

Each awarded value appears locally near the receiving country’s current score.

Animation specifics:
* `+X` appears slightly underneath the current score.
* It feels like it emerges from a small hidden pocket under the score.
* It slides up slightly.
* It overshoots just a little.
* It settles overlapping the lower third of the score.
* It inflates slightly.
* It deflates/collapses into the current score.
* On collision, the score shakes briefly left-to-right.
* The score then rapidly rolls upward like a slot machine / mechanical counter / old bank till / odometer.
* Do not instantly replace the number.

Timing:
* Award indicators should appear in a staggered cascade.
* They should not wait for one full score update to finish before starting the next.
* Around when `+6` appears, `+1` should begin collapsing into its score.
* After all 10 scores finish updating, then reshuffle the scoreboard.

Reshuffle:
* Do not reshuffle after each individual point.
* After all awarded points are applied, all affected cards/pills slide simultaneously to their new positions.
* No jumpy re-render.
* No fade out/fade in.
* The user should visually track movement.
---
# Eurovision Results Night: Video Jury Animation
When video clips are enabled:
* Embed the YouTube video above the jury award panel area.
* Start at `delegationStartTime` or `twelvePointAnnouncementStartTime`, depending on the selected mode.
* The jury panel should display only points 1–10 immediately.
* Points 1–10 use the same local pocket animation and are applied right away.
* Do **not** reshuffle yet.
* The 12 points are delayed until `twelvePointTimestamp`.

Special video-mode `+12`:
* Around 3 seconds before the actual 12-point timestamp, show a large centered `+12`.
* It should already be visible before the spoken announcement.
* It does **not** roll or shake like televote.
* At `twelvePointTimestamp`, it compresses slightly, then flies into the receiving country’s score.
* Score shakes.
* Score rolls upward mechanically.
* Then the scoreboard reshuffles.
* Continue until `delegationEndTime`, then show/enable Next Delegation.
---
# Eurovision Results Night: Televote Animation
The televote should be scoreboard-first.
Do **not** display a separate current country panel. Do **not** display current placement/current score separately. The scoreboard already contains that.

For each televote reveal:
1. Highlight the country’s existing scoreboard pill/card.
2. Show a large centered `+0`.
3. The number fades in and immediately begins rolling upward.
4. It shakes rapidly left-right while rolling, like a casino jackpot / slot machine / mechanical Rolodex.
5. Every number from 0 to the final televote score should be traversed.
6. The duration should be about the same regardless of score; larger scores roll faster, smaller scores roll slower.
7. When it reaches the final score, it overinflates slightly, pauses, then deflates slightly.
8. Then it flies toward the highlighted country’s score.
9. It crashes into the score.
10. The score shakes.
11. The total score rolls upward mechanically.
12. Then the scoreboard reshuffles.
13. After reshuffle, the country’s points are marked completed.

Important:
* Completed means that country’s **points** are locked, not its position.
* A completed country can still move up/down if later countries get more points.
* Do not use a lock icon.
* Use a left-to-right darkening sweep across the pill/card.
* Background and text become slightly darker/reduced emphasis but remain readable.
* This indicates “this country has already received televote points.”

For non-video mode:
* User manually presses Next between countries.
* Modern Eurovision order should use jury points ascending, lowest jury score first.
* Edge cases for jury-only or televote-only older years can be handled later.

For video mode:
* Televote video is one continuous segment.
* Start at `televote.beginTimestamp`.
* End at `televote.endTimestamp`.
* Each country’s animation starts exactly when actual playback reaches that country’s `pointsAnnouncedAt`.
* Do not split the televote into separate clips.
* Do not require pressing Next between televote countries.
---
# YouTube Synchronization Bug / Fix
The current code schedules video events using wall-clock timers like:
```ts
(pointsAnnouncedAt - beginTimestamp) * 1000
```

or:
```ts
(twelvePointTimestamp - startTimestamp) * 1000
```

This is wrong because YouTube buffers. If the video buffers, JS timers continue but video playback pauses, so the animation fires too early.

Correct approach:
Use the YouTube IFrame API and synchronize against actual video playback time:
```ts
player.getCurrentTime()
```

Reveal events should trigger when:
```ts
player.getCurrentTime() >= configuredTimestamp
```
not when a timeout expires.

Important Codex instruction:
* Do not refactor the whole Predictions panel.
* Do not split the giant file yet.
* This should be a targeted sync fix only.
* Wall-clock timers are still okay for short UI animation delays after a video-synced event has triggered.
* Wall-clock timers are **not** okay for deciding when a video timestamp is reached.

Current component has code like:
```ts
schedule(
  () => {
    runTelevoteAnimation(song, index);
  },
  (announcedAt - begin) * 1000,
);
```

This needs to become playback-time monitoring.

Use either:
```text
requestAnimationFrame
```
or:
```text
setInterval every 100–250ms
```
to check `player.getCurrentTime()`.

Track fired events so they only trigger once.
---

# Global Rankings Feature
The app had an “All Songs” page, but this is being replaced/refactored into **Global Rankings**.
Global Rankings are a master ranking across multiple Eurovision years.

Important concept:
```text
Year rankings = source order for that year
Global rankings = persistent master order across inserted years
```

Global Rankings must be its own persistent dataset, not just “all JSON songs + saved order.”
Codex implemented Phase 1 Global Rankings:
* `/global-rankings`
* `/all-songs` redirects there
* Dedicated global ranking state using `song.id` only
* inserted years
* timestamps
* total song count
* manual adjustment tracking
* first-time setup
* add year
* re-rank year
* “Tell Me What’s Changed”
* default-order warning
* manual placement
* comparison insertion scaffolding
* protected reset
* Supabase migration/schema support with local storage fallback

Vite build passes, but there’s a chunk-size warning. I’m not worried about that now. It’s probably because the bundle is getting large from JSON/data/features. Later maybe route-based lazy loading/code splitting.
---
# Global Rankings Data Rules
Global ranking should store stable `song.id` values only.
Do **not** identify songs by country or year+country.
Reason: 1956 had two songs per country.

Bad:
```json
["1956-switzerland"]
```
Good:
```json
["1956-switzerland-refrain", "1956-switzerland-das-alte-karussell"]
```
Or whatever existing `song.id` exists.

Global Ranking order should be an ordered array of song IDs.
Positions are derived from array order.
Do not store position as primary truth.
---
# Global Rankings First-Time Setup
If no Global Ranking exists:
* User chooses a starting year.
* Initialize Global Rankings using that year’s current Overall ranking.
* No comparisons required for the first year.

Potential issue:
The app cannot perfectly know if a year has been ranked, because the Overall tab always has an order from JSON/default.

So instead:
If the year’s current Overall ranking exactly matches default JSON order, warn:

```text
It looks like you may not have ranked [YEAR] yet.

Global Rankings will use the current [YEAR] Overall order as its starting source.

For best results, complete or review your [YEAR] Overall ranking before using it in Global Rankings. Otherwise, your Global Ranking results may not be accurate.
```

Buttons:
```text
Cancel
Continue Anyway
```

Do not hard block. Matching JSON order does not prove the user didn’t intentionally rank it that way.
---
# Global Rankings Add / Re-rank Year

When adding a new year:
* Use current Global Ranking order as baseline.
* Use selected year’s current Overall ranking as pending order.
* Insert selected year into Global Ranking.

When re-ranking an existing year:
* Remove all songs from that selected year from Global Ranking.
* Preserve the relative order of all other songs.
* Reinsert the selected year using that year’s current Overall ranking.

Re-ranking warning:
```text
You are about to re-rank [YEAR].

This will remove all [YEAR] songs from Global Rankings and reinsert them using the current [YEAR] Overall ranking.

If you manually changed [YEAR] songs inside Global Rankings but did not update the [YEAR] Overall ranking, results may differ.
```
---
# “Tell Me What’s Changed” Button

This button compares the relative order of songs from a selected year inside Global Rankings against the relative order in that year’s Overall ranking.

Only compare intra-year contradictions, not every absolute position difference.

Example:

Global Rankings has:

```text
Denmark above Hungary
```

2018 Overall has:

```text
Hungary above Denmark
```

Then report:

```text
Denmark is currently above Hungary in Global Rankings, but Hungary is above Denmark in your 2018 Overall ranking.
```

Explain:

```text
The reinsertion process uses your 2018 Overall ranking as the source order, so Denmark may move below Hungary if you continue.
```

---

# Global Rankings Comparison UI Issue

The current global comparison page looks wrong/weird compared to the year comparison overlay.

Global comparison should reuse or closely match the existing year ranking comparison overlay.

Desired:

* Same layout
* Same card sizing
* Same preview/video handling
* Same choose buttons
* Same progress UI
* Same right-side current ranking/preview order
* Same responsive behavior

It should feel like the same comparison feature, just for Global Rankings.

Do not invent a whole new split-page layout if the existing overlay can be reused.

---

# Global Rankings Insertion Algorithm

The selected year already has an internal order.

Example:

```text
2018 Overall:
1 Hungary
2 Albania
3 Denmark
4 Ireland
```

During global insertion, never ask:

```text
Hungary vs Albania
```

or:

```text
Albania vs Denmark
```

because the year ranking already answered that.

Algorithm:

```text
baselineIds = current Global Ranking song IDs
pendingIds = selected year song IDs ordered by that year’s current Overall ranking
```

If re-ranking existing year:

```text
baselineIds = current Global Ranking minus all songs from selected year
pendingIds = selected year song IDs ordered by that year’s current Overall ranking
```

Insert pending songs sequentially.

For each pending song:

* Use binary-search-style comparisons against the current global baseline/projected global order.
* Once inserted, move to next pending song.
* Later pending songs cannot be inserted above earlier pending songs from the same year.
* Use the previous inserted song’s position as the upper bound/lower bound constraint.

Example:

Global baseline:

```text
1 Song A
2 Song B
3 Song C
4 Song D
5 Song E
```

Selected year:

```text
1 Hungary
2 Albania
3 Denmark
```

If Hungary inserts after Song B:

```text
1 Song A
2 Song B
3 Hungary
4 Song C
5 Song D
6 Song E
```

Albania must search below Hungary only.

If Albania inserts after Song C:

```text
1 Song A
2 Song B
3 Hungary
4 Song C
5 Albania
6 Song D
7 Song E
```

Denmark must search below Albania only.

This reduces comparisons and preserves year order.

---

# Global Rankings Compare Metadata

Global comparison should use existing song metadata from year JSON files:

* `previewVideoUrl`
* compare start timestamp / climax timestamp
* title
* artist
* country
* year
* flag/emoji

Do not create new video metadata just for global rankings.

The compare play button should start near the song’s chorus/climax if the metadata exists, just like year comparison mode.

---

# Reset Global Rankings

This is destructive and must be protected.

Global rankings could eventually contain 1,200–1,800 songs and tons of manual comparison work.

Reset button should warn:

```text
This will permanently delete ALL Global Rankings.

This action cannot be undone.

We recommend re-ranking an individual year instead.
```

Then require typed confirmation:

```text
CONFIRM
```

before delete button enables.

---

# Manual Edits

Manual placement exists but should not be the recommended workflow because global ranking could eventually have 1,500+ songs.

Rank by comparison should be the recommended default.

Manual edits should become authoritative within Global Ranking. Future insertions must respect the current global order.

Important warning:

If user manually changes a song’s position within Global Ranking but does not update that year’s Overall ranking, then re-ranking that year later may undo/alter those manual changes, because re-insertion uses year Overall ranking as source order.

---

# Current Personal Eurovision Watching Context

I’m watching Eurovision in a spoiler-avoidant way.

Years I’ve watched in full include:

```text
1956
1957
1958
1966
2018
2023
2024
2025
2026
```

I also know spoilers for some winners/years:

```text
1988
1989
1990
1991
1997
1998 now
2004
2016
2017
2022
```

I’m trying to avoid more spoilers where possible.

I watched Eurovision 2018 and was surprised/disappointed that Israel won because it was my first Israel entry not in my top group. I had Israel around 13th in the final after ranking it low compared to 2023–2026 Israel.

2018 rankings are still fluid. My current rough final ranking after the final was something like:

```text
1 Hungary
2 Albania / Denmark swap area
3 Denmark / Albania
4 Ireland
5 Netherlands
6 Germany
7 Austria
8 Australia
9 Ukraine
10 Cyprus
11 Norway
12 France
13 Israel
...
```

But I plan to use the comparison tool with timestamps/climax clips to produce the real final all-2018 ranking including non-qualifiers.

A big reason Global Rankings matters is that I want to create an Apple Music playlist called “Eurovision Through the Years” ordered by my personal ranking across all years I’ve watched.

---

# Immediate Next Tasks

Likely next things to do in the new chat:

1. Give Codex a targeted prompt to fix YouTube synchronization using `player.getCurrentTime()` instead of wall-clock timers.
2. Give Codex a targeted prompt to fix Global Rankings comparison mode:

   * reuse year comparison overlay UI
   * implement proper ordered-block insertion algorithm
   * preserve internal year order
   * never compare same-year pending songs against each other
3. Test Global Rankings with a base year like 2026 and insert 2025 or 2018.
4. Fix any UI oddities on Global Rankings.
5. Later revisit Results Night video polish and possibly component refactoring, but avoid giant risky refactors for now.

---

# Important Development Preference

Codex can build things quickly, but it tends to mess up if prompts are vague or if it tries to refactor too much at once.

Preference:

```text
Small, highly detailed, targeted prompts.
```

Avoid asking Codex to:

```text
Refactor the entire 2,887-line Predictions panel.
```

unless absolutely necessary.

Better:

```text
Fix only YouTube sync.
Fix only Global comparison UI.
Fix only back button reveal mode selection.
```

The app is getting complex enough that preserving working behavior matters more than broad cleanup right now.
