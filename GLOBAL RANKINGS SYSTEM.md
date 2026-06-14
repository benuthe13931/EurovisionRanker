GLOBAL RANKINGS SYSTEM
PHASE 1 – FOUNDATIONAL UX, DATA MODEL, AND YEAR INSERTION

OVERVIEW

This phase introduces Global Rankings. This will replace the current "All Songs" page.
Global Rankings allow the user to compare Eurovision songs across multiple years and maintain a single master ranking containing every song they have ranked.

IMPORTANT:
The Global Rankings system is NOT rebuilt from scratch each time.
The Global Rankings database becomes the source of truth with respect to future Global Ranking entries.
Future year insertions add to the existing ranking.

They do NOT recreate it.
==================================================
CORE PHILOSOPHY
==================================================
The existing yearly ranking pages remain unchanged.
Users should continue ranking:
* 1956
* 1957
* 2018
* 2023
* 2024
* etc.
using the existing ranking interfaces.

Global Rankings should use those yearly rankings as insertion sources.

Once songs are inserted into Global Rankings:
Global Rankings become the authoritative ordering on the Global Rankings page.
Future insertions must respect the current Global Ranking order.

Never rebuild the entire Global Ranking automatically.
==================================================
GLOBAL RANKINGS LANDING PAGE
==================================================
Create a dedicated Global Rankings page.

This page should contain:
* Current total songs ranked
* View current rankings button
* Years already inserted
* Years not yet inserted
* Add Year button
* Re-rank Existing Year button
* Reset Global Rankings button
==================================================
INSERTED YEAR TRACKING
==================================================
Display all Eurovision years.

Provide visual distinction between:
Inserted Years
and
Not Yet Inserted Years

Example:
✓ 1956
✓ 1957
✓ 1958
✓ 2018
✓ 2023

□ 1959
□ 1960
□ 1961

The user should always know which years they have previously added in Global Rankings.
==================================================
FIRST TIME SETUP
==================================================
If no Global Rankings exist:
Prompt user to select a starting year.

Example:
Select the first year to initialize Global Rankings.
The selected year becomes the initial Global Ranking dataset.

No comparisons are required.
Simply copy the current ordering from that year's rankings.
==================================================
ADDING A NEW YEAR
==================================================
When the user selects a year that has not yet been inserted:

Prompt:
You are about to insert 2019 into Global Rankings.
For best results, ensure that your 2019 rankings are finalized in the "Overall" tab on the year's specific page before continuing.
One button should then allow a redirect to that year specific page so they can confirm.

Continue?

Buttons:
Cancel
Continue
Take me to my year's rankings
==================================================
INSERTION METHOD SELECTION
==================================================
After continuing:

Prompt:
How would you like to insert this year?

Options:
Recommended:
Rank By Comparison

Alternative:
Manual Placement
==================================================
RANK BY COMPARISON
==================================================
This should be the recommended default.
Visually emphasize this option.

Include a tooltip:
Two songs will be shown side-by-side.
Select the song you prefer.
The system will gradually determine where songs from the selected year belong within your existing Global Rankings.

You may optionally preview each song before deciding.
==================================================
SONG PREVIEW SUPPORT
==================================================
The Global Comparison tool should reuse the same metadata already used elsewhere in individual year ranking pages.
Do NOT create a new data source.
Use the existing year JSON files.

Continue using:
* preview video URL
* comparison start timestamp
* song metadata

The same data already used by yearly comparison mode should be reused.
==================================================
VIDEO PREVIEW BEHAVIOR
==================================================
If the user presses play:
Load the preview video.

Start playback using:
compareStartTime

The purpose is to immediately show the most representative section of the performance.

Typically:
* chorus
* climax
* strongest performance moment

Users should still be able to scrub the video manually.

Note: This is and should already be the default behaviour of the existing compare tool, this is just a reiteration.
==================================================
MANUAL PLACEMENT MODE
==================================================
Allow users to insert songs manually.

HOWEVER:
This should not be the recommended workflow.

Global Rankings may eventually contain:
* hundreds of songs
* thousands of songs

Manual placement becomes increasingly difficult at large scale.

Therefore:
Rank By Comparison should always be visually recommended.
==================================================
RE-RANK EXISTING YEAR
==================================================
Users must always be allowed to reinsert a year.
No year should ever become permanently locked.

When selecting an already inserted year:
Display warning:
You are about to re-rank 2018.

The insertion process uses the current ordering from the 2018 rankings page.

If you have manually adjusted 2018 songs within Global Rankings but have NOT updated the 2018 rankings page accordingly, results may differ from expectations.

Continue?

Buttons:

Cancel
Continue
Take me to my year's rankings
Tell me what's changed

The tell me what's changed should be a unique feature that scrubs the overall rankings data for that user's current rankings and compares it to the data currently stored in their year specific overall rankings.
It should then highlight years that may have changed rankings in their global leaderboard with respect to their year page. 

Example:
1. One year in 2023 the user has Moldova in 7th and Lithuania in 13th.
2. The user manually moves Lithuania above Moldova specifically in their global rankings board at some point.
3. The user does not, however, update the 2023 page with the same adjustment of placing Lithuania above Moldova.
4. Now Lithuania techincally should be ranked over Moldova for the comparison algorithm moving forward; however, since they did not adjust the year page, when the compare tool goes to use the expected algorithm it will assume that Lithuania is under Moldova and never present the opportunity for it to be ranked above based on how we are utilizing boundary boxes for the sorting.
5. We must call out to the user that they currently have placed Lithuania above Moldova in their global rankings but not in the year's rankings. Alert that this may cause unexpected results as the system will assume - during comparison - that the user still believes Moldova is above Lithuania.
==================================================
GLOBAL RANKING AUTHORITY
==================================================
The current Global Ranking order is always authoritative.

Example:
Hungary 2018 originally inserted at #50.
User manually moves Hungary 2018 to #20.

Future insertions must respect the current Global Ranking ordering.
Never revert songs to historical insertion positions.

Never silently rebuild rankings.
==================================================
RESET GLOBAL RANKINGS
==================================================
This is destructive.

Global Rankings may eventually contain:
* hundreds of hours of work
* thousands of songs
* years of user comparisons

Therefore:
Reset must be heavily protected.
==================================================
RESET CONFIRMATION STEP 1
==================================================
Show warning:
This will permanently delete ALL Global Rankings.
This action cannot be undone.
All inserted years, comparisons, and rankings will be lost.
We recommend re-ranking an individual year instead.

Do you wish to continue?

Buttons:
Cancel
Continue
==================================================
RESET CONFIRMATION STEP 2
==================================================
If Continue is selected:
Require typed confirmation.

Prompt:
Type CONFIRM to permanently delete all Global Rankings.

Input:
---

Button:
Delete Global Rankings

Button remains disabled until:
CONFIRM

is entered exactly.
==================================================
DATA MODEL REQUIREMENTS
==================================================
Create dedicated Global Ranking storage.

Do NOT derive Global Rankings solely from yearly rankings.

Track:
* inserted years
* insertion timestamps
* total song count
* current global ordering
* manual adjustments

Global Rankings must persist independently of yearly rankings.
==================================================
PHASE 1 COMPLETION CRITERIA
==================================================
Phase 1 is complete when:
* Global Rankings page exists
* Inserted years are tracked
* First-time initialization works
* New year insertion flow works
* Comparison mode entry point exists
* Preview videos reuse existing metadata
* Re-ranking warnings exist
* Reset protection exists
* Global Rankings persist independently

The comparison algorithm itself will be expanded in future phases.