==================================================
PHASE 3
VIDEO-SYNCHRONIZED RESULTS NIGHT
==================================================
OVERVIEW
Phase 3 does NOT replace Phase 2.
Phase 3 does NOT create a new results engine.
Phase 3 should reuse the existing Phase 2 implementation wherever possible.

All existing functionality should continue to behave exactly the same:
* scoreboard
* score updates
* reshuffling
* televote processing
* locking
* winner reveal

In the same way:
The scoreboard should never disappear, even when video is playing.
The video is supplemental.
The scoreboard remains the primary experience.

Phase 3 introduces only one major capability:
Video synchronization.

The purpose of Phase 3 is to make the existing Results Night experience occur in sync with actual Eurovision footage.
==================================================
JURY PHASE VIDEO MODE
==================================================
When jury video data exists:

Embed the YouTube player above the delegation information area.
The scoreboard must remain visible.
The scoreboard remains the primary focus.
The video should never replace the scoreboard.

1 new field should be added to the json that was previously missed: "juryAnnouncementOrder". It is simply an array that contains the countries in the order they are announced at the jury phase.
Note: THIS DOES ALSO APPLY TO PHASE 2. IT WAS PREVIOUSLY MISSED. THE ORDER THAT PHASE 2 SHOULD DISPLAY THE JURY PHASE NEEDS TO ALSO FOLLOW THE ORDER IN THIS FIELD.
==================================================
JURY VIDEO START
==================================================
When the user presses Next:
Load the delegation video.

Seek to:
delegationStartTime

Begin playback.
==================================================
POINTS 1-10
==================================================
Immediately after playback begins:
Display the awarded points list.

Example:
10 points to Germany
8 points to Spain
7 points to Italy
6 points to Sweden
5 points to Belgium
4 points to Norway
3 points to Cyprus
2 points to Portugal
1 point to Lithuania

Process:
1 point through 10 points immediately.
The same scoreboard-local pocket animation from Phase 2 should be used.
The awarded points should be applied to their countries.
The awarded points should collapse into their scores.
The scores should update.

IMPORTANT:
Do NOT reshuffle yet.
DO NOT announce the 12 points at this time.
==================================================
12 POINT REVEAL
==================================================
The 12-point recipient should NOT be processed immediately.

The 12-point award must wait.

At:
twelvePointTimestamp
begin the special 12-point animation.
==================================================
SPECIAL 12 POINT ANIMATION
==================================================
Unlike Phase 2 scoring animations:
The +12 should appear in the center of the screen.

Approximately 3 seconds before:
twelvePointTimestamp

display:
+12
large and centered.

The +12 should already be visible before the spoken announcement occurs.
The number should not roll.
The number should not shake.
The number should simply exist.

The purpose is anticipation.
==================================================
12 POINT IMPACT
==================================================
When:
twelvePointTimestamp
is reached:

The +12 should:
1. Begin to compress compress.
2. Launch toward the receiving country's scoreboard pill.
3. Collapse into the score.
4. Trigger score shake.
5. Trigger score update.

REMINDER:
The 12 points does NOT fly to the country announcing the points. It flies to the country delegated 12 points under the "votesAwarded" array.

The score update should reuse the existing Phase 2 score animation.
==================================================
POST-12 RESHUFFLE
==================================================
After the 12 points have been applied:
Perform the normal scoreboard reshuffle.
Reuse all existing Phase 2 reshuffle behavior.
No special logic should be introduced.
==================================================
DELEGATION COMPLETION
==================================================
Continue playback until:
delegationEndTime

When:
delegationEndTime
is reached:
Pause playback.

Display:
Next

Allow the user to continue.
==================================================
TELEVOTE VIDEO MODE
==================================================
The televote phase should reuse the existing Phase 2 televote implementation.
The animation logic should remain identical.

The only difference:
Events become timestamp-driven instead of button-driven.
==================================================
TELEVOTE START
==================================================
Load:
televote.url

Seek to:
beginTimestamp

Begin playback.
==================================================
TELEVOTE ANNOUNCEMENTS
==================================================
Countries should still be processed using the same reveal order from Phase 2.

The difference:
The user does not press Next.

Instead:
Each country's reveal is triggered when the video reaches:
pointsAnnouncedAt
==================================================
TELEVOTE SCORE REVEAL
==================================================
At:
pointsAnnouncedAt
begin the existing Phase 2 televote animation.

Reuse the exact same:
* center-screen number
* Rolodex animation
* shake animation
* score collision
* score update
* reshuffle
* locking

No animation changes should be introduced.
==================================================
TELEVOTE COMPLETION
==================================================
Continue processing timestamps until all countries have received televote points.

When:
endTimestamp
is reached:
The televote segment is complete.

Proceed to the winner reveal using the existing Phase 2 logic.
==================================================
PHASE 3 COMPLETION CRITERIA
==================================================
Phase 3 is complete when:

* Jury playback synchronizes correctly
* 12-point reveals synchronize correctly
* Televote playback synchronizes correctly
* Scoreboard events occur at timestamps
* Existing Phase 2 behavior remains unchanged

Phase 3 should feel like:
"Watching the actual Eurovision broadcast while the scoreboard simulation stays synchronized."
Not:
"A separate implementation of Results Night."