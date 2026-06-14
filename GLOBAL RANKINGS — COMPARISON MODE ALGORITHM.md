GLOBAL RANKINGS — COMPARISON MODE ALGORITHM + UI FIX
CONTEXT
Global Rankings Phase 1 now exists.

The page currently supports:
* Global Rankings route
* inserted year tracking
* first-time setup
* add year
* re-rank year
* reset protection
* local/Supabase persistence
* comparison insertion scaffolding

However, Global Ranking comparison mode needs two important corrections:
1. The comparison UI should visually match the existing year ranking comparison overlay.
2. The insertion algorithm must preserve the selected year’s existing order while inserting that year into the current Global Ranking baseline.

Two very small UI bugs: 
1. When the user has no years currently set for their global rankings the UI displays all years with checkmarks and has it under "Start Global Rankings". This is confusing as after you pick an initial year you then see:
"Years Already Inserted" - Contains green checkmark
"Years Not Yet Inserted" - Contains blue plus
2. When the user is on the "View Current Rankings" page, the "View Current Rankings" button is still present and is redundant as you are already on that page. Simply hide the button when you are already viewing results.

That should be the structure from the beginning. When there is no previous year and you are selecting for the first time, it should simply show "Years Not Yet Inserted" as it currently does, with the plus symbols. The same popup about year initializtion that it currently does still remains correct. This is simply removing the "Start Global Rankings" selection box and simply showing "Years Not Yet Inserted" from the beginning.

Do NOT rewrite unrelated ranking pages.
Do NOT refactor unrelated prediction/trivia/results code.

This task is focused only on Global Rankings comparison insertion.
==================================================
PART 1 — COMPARISON UI MUST MATCH YEAR OVERLAY
==============================================
The current Global Rankings comparison layout does not match the existing year-specific comparison overlay.
Fix this.
The Global Rankings comparison screen should reuse or closely replicate the existing year comparison overlay component/layout.

Expected behavior:
* Same overall visual layout as year comparison mode.
* Same card sizing.
* Same video/image treatment.
* Same “Pick this song” button treatment.
* Same keyboard instructions.
* Same progress bar style.
* Same current ranking sidebar style.
* Same reset/close controls.
* Same responsive behavior.

The Global Rankings comparison mode should feel like the same feature, just operating on Global Rankings.
Do not invent a separate comparison UI for Global Rankings unless absolutely necessary.
If possible, reuse the existing comparison component and pass different data into it.

The only meaningful difference should be the data source and current ranking sidebar content.
==================================================
PART 2 — GLOBAL CURRENT RANKING SIDEBAR
=======================================
The right-side current ranking / preview order sidebar in Global Rankings comparison mode should show the current Global Ranking order.
It should update after each comparison pick.

It should show:
* rank number
* flag / country marker
* song title
* artist
* year if not already obvious

Example:
1. Luxembourg 2026 — Mother Nature
2. Slovenia 2025 — How Much Time Do We Have Left
3. Hungary 2018 — Viszlát nyár

The sidebar should not show a weird temporary list or selected-year-only list unless the current insertion process has not yet produced a global order.
The sidebar should represent the current projected Global Ranking after each choice.
==================================================
PART 3 — GLOBAL INSERTION ALGORITHM
===================================
Global insertion is NOT the same as ranking a single year.
The selected year already has an internal order from that year’s Overall ranking.
The algorithm must preserve that internal year order.

Example selected year ranking:
2018 Overall:
1. Hungary
2. Albania
3. Denmark
4. Ireland

The Global insertion process must never ask:
2018 Hungary vs 2018 Albania
or:
2018 Albania vs 2018 Denmark
because those questions have already been answered by the year’s Overall ranking.

The year ranking is the source order.
==================================================
BASELINE AND PENDING SONGS
==========================
When inserting a new year:
baselineIds =
current Global Ranking song IDs

pendingIds =
selected year song IDs ordered by that year’s current Overall ranking

When re-ranking an existing year:
1. Remove all songs from that selected year from the current Global Ranking.
2. Preserve the relative order of every other song.
3. Use the remaining Global Ranking as baselineIds.
4. Use the selected year’s current Overall ranking as pendingIds.
5. Reinsert pendingIds into baselineIds.

This prevents duplicate songs and makes re-ranking predictable.
==================================================
IMPORTANT SOURCE OF TRUTH RULES
===============================
The current Global Ranking order is authoritative for already-inserted songs.
The selected year’s current Overall ranking is authoritative for that year’s internal order during insertion.
Do not reorder songs within the selected year during insertion.
Do not compare songs from the same pending year against each other.
==================================================
INSERTION SEARCH STRATEGY
=========================
Insert songs from pendingIds sequentially.
Start with the highest-ranked pending song.

For each pending song:
* Search for its correct insertion point within the available baseline range.
* Use side-by-side comparisons against existing Global Ranking songs.
* Once inserted, move to the next pending song.

Optimization rule:
Because pendingIds are already ordered, each later pending song cannot be placed above any earlier pending song from that same year.

Example:
If Hungary is inserted at global position 12,
then Albania can only be inserted at position 13 or lower.

If Albania is inserted at position 24,
then Denmark can only be inserted at position 25 or lower.

Use this to reduce comparisons.
==================================================
BINARY SEARCH / INSERTION POINT LOGIC
=====================================
Use binary search-style insertion against the allowed baseline range.

For each pending song:
1. Determine allowed search range.
2. Compare pending song against midpoint song from the current Global Ranking.
3. If user chooses pending song:
   * pending song belongs above midpoint.
   * search upper half.
4. If user chooses baseline song:
   * pending song belongs below midpoint.
   * search lower half.
5. Continue until insertion point is determined.
6. Insert pending song into projected Global Ranking.
7. Move to next pending song.

The current projected Global Ranking should update after each insertion.
==================================================
ORDER PRESERVATION EXAMPLE
==========================
Initial Global Ranking:
1. Song A
2. Song B
3. Song C
4. Song D
5. Song E

Selected year ranking:
1. Hungary
2. Albania
3. Denmark

Step 1:
Insert Hungary into Global Ranking.

After comparisons:
1. Song A
2. Song B
3. Hungary
4. Song C
5. Song D
6. Song E

Step 2:
Insert Albania.

Because Albania is ranked below Hungary in the selected year,
Albania must search only below Hungary.

Possible result:
1. Song A
2. Song B
3. Hungary
4. Song C
5. Albania
6. Song D
7. Song E

Step 3:
Insert Denmark.

Because Denmark is below Albania,
Denmark must search only below Albania.

Possible result:
1. Song A
2. Song B
3. Hungary
4. Song C
5. Albania
6. Denmark
7. Song D
8. Song E

==================================================
COMPARISON COUNT
================
Show progress.
Example:

12 / 147 comparisons

This count does not need to be perfect, but it should update consistently.
If an exact total is difficult due to adaptive binary search, estimate the total at session start and update actual completed comparisons.

Do not let a bad estimate break the flow.
==================================================
CHOOSING A SONG
===============
When user chooses one of the two songs:

* Record the choice.
* Narrow the insertion range.
* If insertion point is found, insert the pending song.
* Update current projected Global Ranking.
* Advance to next comparison or next pending song.

The UI should feel identical to existing year comparison mode.
==================================================
RANGE PROBING OPTIMIZATION
==========================
The insertion algorithm may use range probing before standard binary insertion.
This is optional, but recommended for large Global Rankings.

Purpose:
Avoid starting every pending song with a full binary search across hundreds or thousands of songs.

Because pendingIds are already ordered, each pending song already has a known upper boundary:
* the song inserted immediately before it from the same selected year

Example:
If Hungary was inserted at position 12, then Albania cannot be inserted above position 13.
Therefore Albania’s search should begin below Hungary.
==================================================
WINDOW / BLOCK SEARCH
=====================
Before running binary search, the algorithm may scan downward in windows.

Example window size:
50 songs

The exact size can be adjusted by implementation.

For each pending song:
1. Start immediately below the previously inserted pending song.
2. Select a lower boundary candidate, such as 50 positions below the current upper boundary.
3. Compare the pending song against that lower boundary song.

If the user chooses the lower boundary song:
* the pending song belongs below that boundary
* everything above that boundary can be skipped
* move to the next window

If the user chooses the pending song:
* the pending song belongs somewhere between:
  * the current upper boundary
  * and the tested lower boundary
* run binary search within that narrowed window

EXAMPLE:
Current Global Ranking:
1. Song A
2. Song B
3. Hungary
4. Song C
5. Song D
   ...
53. Song Z

Next pending song:
Albania

Because Albania is below Hungary in the selected year ranking:
Albania cannot be placed above Hungary.
The search begins below Hungary.

The algorithm may compare:
Albania vs Song Z

If Song Z wins:
Albania belongs below position 53.

Skip positions 4-53 and test the next window.

If Albania wins:
Albania belongs somewhere between Hungary and Song Z.

Run binary search within that range.
==================================================
COMPARISON COUNT ESTIMATION
===========================
Because range probing is adaptive, the exact comparison count may be difficult to know in advance.
The app should still show progress.

Acceptable example:
12 / ~147 estimated comparisons

The estimate may change as the insertion process learns where songs belong.
This is expected.

Do not let an imperfect estimate break the comparison flow.
The total comparison count may be approximate.
==================================================
VIDEO PREVIEW METADATA
======================
Use existing song metadata from year JSON files.
Do not create new video metadata for Global Rankings.

Use the same fields already used by year comparison mode, such as:
* previewVideoUrl
* compareStartSecond / compareStartTime / existing equivalent
* title
* artist
* country
* year
* flagEmoji

Whatever field names already exist in the codebase should be reused.
==================================================
FIRST-TIME INITIALIZATION
=========================
If no Global Ranking exists:
The user selects a starting year.
Initialize Global Ranking by copying that year’s current Overall ranking order.
No comparisons are needed for the first year.

If that year’s current Overall ranking appears to exactly match default JSON order:
Show warning:
“It looks like you may not have ranked [YEAR] yet.
Global Rankings will use the current [YEAR] Overall order as its starting source.
For best results, complete or review your [YEAR] Overall ranking before using it in Global Rankings. Otherwise, your Global Ranking results may not be accurate.”

Buttons:
Cancel
Continue Anyway

This is a warning only, not a blocker.
==================================================
RE-RANK EXISTING YEAR
=====================
When user re-ranks an already inserted year:

Show warning:
“You are about to re-rank [YEAR].

This will remove all [YEAR] songs from Global Rankings and reinsert them using the current [YEAR] Overall ranking.

If you manually changed [YEAR] songs inside Global Rankings but did not update the [YEAR] Overall ranking, results may differ.”

Buttons:

Cancel
Continue

Also provide:
Tell Me What’s Changed
Take Me to My Year's Rankings
==================================================
TELL ME WHAT’S CHANGED
======================
The “Tell Me What’s Changed” button should compare the relative order of songs from the selected year inside Global Rankings against the relative order of those same songs in that year’s Overall ranking.
Only compare intra-year ordering.
Do not report every absolute position difference.

Example:
Global Rankings:
Denmark above Hungary

2018 Overall:
Hungary above Denmark

Report:
“Denmark is currently above Hungary in Global Rankings, but Hungary is above Denmark in your 2018 Overall ranking.”

Explain:
“The reinsertion process uses your 2018 Overall ranking as the source order, so Denmark may move below Hungary if you continue.”
==================================================
UNIQUE SONG IDS
===============
Global Ranking order must store stable song IDs only.
Do not use country as an identifier.
Do not use year + country as an identifier.

This is especially important for 1956, where each country performed two songs.
Use the existing song.id if available.

If any entry is missing a stable ID, create or normalize one before using it in Global Rankings.
The ID must uniquely identify a single Eurovision entry.

Examples:
1956-switzerland-refrain
1956-switzerland-das-alte-karussell

Global Ranking should store:
[
"2026-luxembourg-mother-nature",
"2025-slovenia-how-much-time-do-we-have-left",
"1956-switzerland-refrain"
]

Positions should be derived from array order.
Do not store position as the primary source of truth.
==================================================
RESET GLOBAL RANKINGS
=====================
Keep existing protected reset behavior.
Reset should be heavily guarded.
The user should have to explicitly confirm.
If typed confirmation is already implemented, keep it.

Do not weaken reset protection.
==================================================
NON-GOALS
=========
Do NOT:

* rewrite the entire ranking system
* modify year ranking behavior
* modify predictions
* modify trivia
* modify results night
* change song metadata fields
* create a new comparison UI from scratch if the existing overlay can be reused

This task is specifically to make Global Rankings comparison insertion correct, efficient, and visually consistent with existing year comparison mode.