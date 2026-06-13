EXPAND PREDICTIONS SYSTEM TO SUPPORT MULTIPLE REVEAL MODES

OVERVIEW

The Eurovision Ranker should support multiple ways of revealing results.
Different users want different levels of suspense.

Some users may simply want to see whether they were correct.
Others may want to recreate the entire Eurovision experience.

The reveal system should therefore be designed around configurable reveal modes.
The grand finals scoreboard should be two columns as to make it easier to see everything at once.

REVEAL MODES - GRAND FINAL
~~~~~
---
Mode 1:
Instant Results (Grand final specific as qualifiers already have their reveal animations)

Purpose:
Fastest possible reveal.

Behavior:
* Immediately reveal all qualifiers or placements.
     * It should show a scoreboard where each country pill animates in left to right from last to first with top 3 increasingly bigger in size and correct border associate fairly quickly.
	 * Each previous animation should finish before the next.
* Show prediction accuracy.
* Show statistics.

Use case:
Users who only care about results.
---
Mode 2:
Step-by-Step Reveal (Grand final specific as qualifiers already have their reveal animations)

Purpose:
Moderate suspense.

Behavior:
* Reveal one qualifier at a time.
* Reveal one placement at a time.
* User manually advances.
* Live accuracy tracking for finals.
* It should follow the same animation format as Mode 1; however instead of quickly showing one ofter the next the user needs to manually click next.

Use case:
Users who want suspense without recreating the entire show.
---
Mode 3:
Eurovision Results Night (Grand final specific)

Purpose:
Recreate the official Eurovision results process.

Behavior:
* Uses actual jury points.
* Uses actual televote points.
* Updates live scoreboard.
* Songs move around the leaderboard dynamically.
* User experiences results as they unfolded.

This should feel like watching the voting sequence.
This is considered the premium reveal experience.

This mode should support two configurations.
---
Option A:
Scoreboard Only

Option B:
Scoreboard + Video Clips
The user selects which experience they want before beginning.
---
CONFIGURATION SCREEN
Before results begin prompt user for their preferred Reveal Experience:
( ) Instant Results - Display final rankings without pauses
( ) Step-by-Step Reveal - Display final rankings one at a time
( ) Eurovision Results Night - Display final rankings one at a time including final points from both the jury and televote (where applicable)

When Eurovision Results Night is selected:
☐ (Optional) Include official announcement clips

NOTE: Unless otherwise specified, all point/score adjustments for the jury portion "smash" should animate like a wheel for the text increasing the numbers. Think slot machine spinning wheel. This does NOT apply to the initial +x itself (even the 12 points) as those are always static values. Increasing score points on the scoreboard AND the large +x ONLY for the televote initial animation should use the spinning wheel animation.
Additionally, when the initial collision of the "smash" occurs the number should shake a bit as if there was an actual impact.

JURY VOTING EXPERIENCE
For years with jury voting:
Display scoreboard.
All countries begin at zero.

As each country awards points:
Show jury's point allocation at the top. One at a time fairly quickly. Use the same text increase then decrease animation that we have been doing (utilizing the two column structure, 5 on each side)

Example:
Sweden has awarded:
12 points to France. | 5...
10 points to Germany. | 4...
8 points to Spain. | 3...
7... | 2...
6... | 1...

Underneath that announcement in the actual scoreboard:
Each countries score increases. (Animate a +x just under the current score for each one at a time. Same increase descrease animation when it pops up. Then start "smashing" them up into the actual score count - quickly counting the numbers upwards to the new score. "Smashing" can occur for the first one once the +x for the 6th country begins. In otherwords, these are slightly async)

Once all of the "smashing" is completed for the 10, based on the new point total:
Scoreboard reorders. This will be unique as ALL countries places should reorder (slide) to their new position simultaneously. Essential just a "reshuffle" effect.

Pause and wait for the user to click next. Continue until all juries are complete.

TELEVOTE EXPERIENCE
After juries complete:
Temporarily freeze scoreboard for a few seconds then display:
"Televote Results"
Wait for user to click continue.

Reveal televotes in official order.
Example:
Country currently in 26th place.
Reveal televote points.
Add the +x under it's current points for a moment, same animation, then same "smash" into the points and quickly increase. Score updates.
Country moves with same animation, shifting all countries with current lower points accordingly and simultaneously.
Once a country's televote/final votes have been revealed and the repositioned scoreboard is settled:
*Darken background with animation left to right, similar to the way we did the qualifiers to signify correct or incorrect answer. This makes it clear which entries can no longer receive additional points. Helps differentiate those who still are waiting to receive televote points as sometimes these may shift far down on the leaderboard temporarily as they are waiting for their score still.
Allow user to press continue until all results have been announced.
A final summary button should appear once the last announcement is made and the winner is shown.

OPTIONAL VIDEO CLIP SUPPORT

If enabled:
When a jury awards points:
Display embedded clip at the top and begin playing from timestamp. 
Underneath video we have a similar flow to the above for everything EXCEPT the 12 points:

This can begin once the video starts playing:
Show jury's point allocation at the top.

Example:
Sweden has awarded:
10 points to France. | 4...
8 points to Germany. | 3...
7 points to Spain. | 2...
6... | 1...
5... (There is nothing next to 5 as only 9 are shown without an announcement)

Underneath that announcement in the actual scoreboard:
Each countries score increases. (Animate a +x just under the current score for each one at a time. Same increase descrease animation when it pops up. Then start "smashing" them up into the actual score count - quickly counting the numbers upwards to the new score. "Smashing" can occur for the first one once the +x for the 6th country begins. In otherwords, these are slightly async)
Do not yet rearrange the cards; however you can change the font color and slightly blow up the point number temporarily to help distinguish updated points while awaiting the final announcement.


After the specified timestamp is reached which indicates the actual timing that the 12 points are announced:
Show a large +12 over the scoreboard (animate it in, no need to overinflate and deflate it, just inflate it from 0 to y size. Pause a brief moment maybe 0.5s then quickly animate it's "smash" into the correct countries point area. This will be slightly different from previous "smashes" because those always appeared under their respective points being updated. This is a large text that may need to slide any direction to "smash")

Apply points with rapidly increasing value.

Only after the points have been "smashed" in for the 12 points - Reorder the scoreboard the same as described above. Any slightly increased temp font size or color can be reset.

Wait until animation finishes and the endTime of the clip has been reached before displaying Continue.

The system should also support televote clips.
It will work in a slightly different way:
This will actually be a long continuous video clip with multiple defined timestamps. 

Begin the video at the designated televoteBeginTimestamp.
At specific time points the hosts will announce the televote results (finalPointAnnouncementStartTime). Once that timestamp is hit, there should be a +x that again, quickly increases in size in the middle of the screen like the +12. This one will have the slight inflate and deflate animation. It should also "violently" shake as it grows and the number should again quickly increase to the actual announced number. Once at the full size (post quick slight deflate) pause a moment before again "smashing" it to the correct point area.
After each one of these announcements the scoreboard should "reshuffle" everything accordingly to the correct place.
Once the scoreboard shuffle has settled we will do similar to without video clip:
*Darken background with animation left to right, similar to the way we did the qualifiers to signify correct or incorrect answer. This makes it clear which entries can no longer receive additional points. Helps differentiate those who still are waiting to receive televote points as sometimes these may shift far down on the leaderboard temporarily as they are waiting for their score still.
The differentiator here is that there will NOT be a continue button between each as this is a single long continuous clip. A final summary button should appear once the televoteEndTimestamp is reached at which point pause the video and simply wait before finally going to the results summary page.


DATA REQUIREMENTS INCLUDING CLIP FIELDS
Create a new data file separate from yearly song data.
Current:
data/years/*.json
Add:
data/results/*.json

Example:
2018-results.json

This should contain:
* Countries jury vote delegation (optional, certain years did not use jury votes for winners, they were strictly tiebreakers)
* Televote votes received (optional, early years did not include televotes)
* Reveal order (An array of countries to make pulling correct data easier.)
* Country vote delegation information
* Video timestamps for reveals of both country delegation (begin clip/end clip) and timestamp where they were awarded televotes

Example:
{
juryRevealOrder: [Sweden, ...],
televoteRevealOrder: [Lithuania...].
televoteBeginTimestamp: 73845,
televoteEndTimestamp: 99864,
countriesAwardedPoints: [
{
country: "Sweden",
finalPlace: 2,
finalPoints: 324,
jury:
{
url: "...",
votesDelegation: [
{
country: Ukraine,
points: 12
},
{
country: Switzerland,
points: 10
},
...
{
country: Belgium,
points: 1
}
]
delegationStartTime: 12345,
twelvePointDelegationTimestamp: 12375
delegationEndTime: 12395
},
televote: {
finalPointAnnouncementStartTime: 12345,
pointsReceived: 97
}
}
...
]
}

PERFORMANCE REQUIREMENTS

Video clips must be optional.
The system must function fully without them.
Users should never be required to load videos.

If no clip data exists:
Fallback to scoreboard-only experience.

DESIGN GOAL
The reveal system should scale from:
"I just want to know who qualified."
to
"I want to relive Eurovision results night exactly as it happened."
~~~~~

The architecture should support both without requiring future redesigns.
