EUROVISION RESULTS NIGHT ENGINE
PHASE 2

OVERVIEW
Phase 1 established:
* Prediction creation
* Prediction storage
* Instant Results
* Step-by-Step Reveal

Phase 2 introduces:
Eurovision Results Night

The purpose of this mode is to recreate the actual Eurovision voting process.

Users should experience:
* Jury voting
* Scoreboard movement
* Position changes
* Televote announcements
* Final winner reveal

This phase does NOT include video playback.
Because there is no video clip creating suspense around the 12-point announcement, all awarded jury points should be animated using the same scoreboard-local animation.

This includes:
* 1 point
* 2 points
* 3 points
* 4 points
* 5 points
* 6 points
* 7 points
* 8 points
* 10 points
* 12 points

Do NOT treat 12 points differently in Phase 2.
The special large center-screen +12 animation is reserved for Phase 3 when official video clips are enabled.
Video support will be added in Phase 3.

All animations and score updates must function correctly without any video data.
==================================================
NEW REVEAL MODE
==================================================
Add:
Eurovision Results Night
to the reveal mode selector.

Reveal Modes:
* Instant Results
* Step-by-Step Reveal
* Eurovision Results Night
==================================================
SUPPORTED RESULT TYPES
==================================================
The engine must support:
jury_only
televote_only
mixed

Examples:
1956-1996
jury_only

Certain late 1990s and 2000s contests
televote_only

Modern Eurovision
mixed

The engine should determine behavior from the results file.
Do not hardcode years.
==================================================
INITIAL SCOREBOARD
==================================================
Before voting begins:
Display all finalists.

All countries start with:
0 points

Countries should initially appear ordered by:
* Running order
  or
* Alphabetical order
Either is acceptable.

Once voting begins:
The scoreboard becomes dynamic.
==================================================
JURY VOTING PHASE
==================================================
For contests with jury voting:
Process delegations one at a time.

For each voting country delegation:
1. Display the delegation header.

Example:
Sweden has awarded:

2. Display the 10 awarded point rows quickly. This should be two columns. Text should animate flying in left to right from 1 point upwards. This is a two column design with the 1 point in the bottom right and 12 points in top left.

Example:
12 points to France | 5 points to Belgium
10 points to Germany | 4 points to Portugal
8 points to Spain | 3 points to Cyprus
7 points to Ukraine | 2 points to Norway
6 points to Italy | 1 point to Lithuania

These point rows may appear quickly in sequence.

3. On the scoreboard, animate each recipient country’s awarded points locally under its current score.
==================================================
LOCAL +X SCORE ANIMATION
==================================================
For every country receiving points, show a local +X indicator directly associated with that country card.

Placement:
* The +X should appear slightly underneath the country’s current score.
* It should slightly overlap the lower third of the current score number.
* It should quickly animate to that position - it should feel like it is emerging from a small hidden pocket beneath the score.

The +X should NOT appear above the card.
The +X should NOT appear in the center of the screen.

Animation:
1. +X starts slightly below the visible score area, as if hidden in a pocket.
2. +X slides upward into view.
3. +X overshoots very slightly.
4. +X settles downward slightly, overlapping the bottom third of the current score.
5. +X expands subtly.
6. +X begins deflating.
7. During deflation, +X collapses into the current score number.
8. When it collides with the score, the score number shakes briefly left-to-right quickly a couple of times as if there was an impact.
9. The score value rapidly counts upward to the new total.

The score count-up should feel like a fast mechanical number roll.

Think:
* slot machine counter
* old bank till
* mechanical odometer
* rapid number wheel

Do not simply replace the number instantly.
==================================================
ASYNC CASCADE TIMING
==================================================
The awarded +X indicators should begin appearing quickly one after another.
They should NOT wait for the previous country’s full score update to complete.
However, they should also NOT all appear simultaneously.
Use a staggered cascade.

Important timing rule:
* Begin showing +1.
* Then +2.
* Then +3.
* Continue upward.
* Around the time the +6 indicator appears, the +1 should begin collapsing into its score.
* This creates a slightly asynchronous overlap.

The animation should feel fast, layered, and energetic.
It should not feel slow or one-at-a-time.
It should not feel chaotic or unreadable.
==================================================
SCORE COLLISION EFFECT
==================================================
When the +X collapses into the score number:

* The score number should shake briefly left-to-right.
* The shake should feel like a small impact.
* The score should then rapidly count upward to the new total.

The shake should be noticeable but not excessive.
==================================================
RESHUFFLE TIMING
==================================================
Do NOT reshuffle after each individual +X update.

Wait until:
* all 10 awarded +X indicators have collapsed into their respective scores
* all 10 score totals have finished counting upward

Only then perform the scoreboard reshuffle.
==================================================
LEADERBOARD RESHUFFLE
==================================================
This is one of the most important features.
DO NOT:
* instantly rerender
* jump positions
* rebuild the list

Instead:
Every affected country card must physically move.
This should feel like a full leaderboard reshuffle.

Important:
* Do not instantly rerender.
* Do not fade cards out and back in.
* Do not jump cards to their new positions.
* Cards should physically slide to their new locations smoothly.
* All affected cards should move at the same time.
* All cards must maintain visibility.

The user must be able to visually track the movement.
The reshuffle should feel alive.
This is a core Eurovision experience.
==================================================
JURY PHASE COMPLETION
==================================================
After final delegation:
Display:
Jury Voting Complete

Pause briefly.

Display:
Current Jury Standings

Allow user to continue.
==================================================
TELEVOTE PHASE
==================================================
For contests with televoting:
Begin televote sequence.

Display:
Televote Results
Countries should be processed one at a time.
The user must manually click Next between each reveal.

For modern Eurovision contests:
Process countries using juryPoints in ascending order (lowest jury score first).
This mirrors the modern Eurovision televote reveal format.

Future support for:
* jury-only contests
* televote-only contests

will be implemented separately as edge cases.
==================================================
SCOREBOARD-FIRST DESIGN
==================================================
The scoreboard should remain visible at all times.
The scoreboard is the entire experience.
Do NOT switch to dedicated announcement screens.
Do NOT replace the scoreboard with modals.
Do NOT display a separate current country panel.
Do NOT display a separate current placement panel.
Do NOT display a separate current score panel.
All information should already exist on the scoreboard.
The user should never need to look away from the scoreboard.
==================================================
CURRENT COUNTRY HIGHLIGHTING
==================================================
Before a country's televote is revealed:
Highlight that country's existing scoreboard pill.

Recommended visual treatments:
* brighter border
* subtle glow
* gentle pulsing effect
* slight scale increase

The highlight should clearly indicate:
"This country is about to receive its televote."

The country should remain in its current scoreboard position.

Do NOT duplicate the card elsewhere.
Do NOT move the card to a special reveal area.

The scoreboard should remain the sole focus.
==================================================
TELEVOTE REVEAL FLOW
==================================================
For each country:

1. Highlight the country's existing scoreboard pill.
2. Begin center-screen televote score animation.
3. Reveal final televote score.
4. Launch awarded score into highlighted scoreboard pill.
5. Update total score.
6. Reshuffle leaderboard.
7. Apply completed-state styling.
8. Wait for next reveal.

The scoreboard should remain visible throughout the entire process.
==================================================
CENTER-SCREEN TELEVOTE SCORE ANIMATION
==================================================
Once the current country's scoreboard pill is highlighted:

Display:
+0
in the center of the screen, although its initial size is virtually non-existent.

The number should begin fading into view immediately.
No separate country name should be displayed.
The highlighted scoreboard pill already identifies the recipient.
==================================================
ROLLODEX / JACKPOT NUMBER ANIMATION
==================================================
The center-screen number should immediately begin increasing.

The animation should resemble:
* a mechanical Rolodex
* a slot machine
* a casino jackpot counter
* an old bank till
* a rapidly rotating number wheel

Every number between:
0
and
Final Televote Score
must be traversed.

Do NOT skip directly to the final value.

Examples:
+28
should visibly pass through:
1
2
3
4
...
28

Examples:
+312
should visibly pass through:

1
2
3
4
...
312

The animation duration should remain approximately the same regardless of final score.
The speed of the rolling numbers should adjust automatically.
Large scores roll faster.
Small scores roll slower.
==================================================
CENTER-SCREEN SHAKE EFFECT
==================================================
While the score is increasing:
The number should rapidly shake left and right.
The motion should feel energetic and unstable.

Think:
* slot machine jackpot animation
* casino payout animation
* rapidly vibrating number counter

As the number approaches its final value:
The shaking should gradually slow.
The number should settle.
==================================================
FINAL SCORE REVEAL
==================================================
When the final televote score is reached:
Example:
+312

The number should:
1. Be slightly overinflated at the moment that number is hit.
2. Immediately deflate slightly. This should be smooth.
3. Pause briefly.

The pause is important.

The user should have a moment to process the awarded score.
==================================================
SCORE COLLISION ANIMATION
==================================================
After the pause:
The center-screen score should travel toward the highlighted scoreboard pill's current score display.

Example:
+312
flies toward:
France's current point total

The movement should feel deliberate and impactful.

When the score reaches the pill:
1. The awarded score collapses into the country's total score.
2. The country's total score shakes left-to-right.
3. The country's total score begins updating.
==================================================
TOTAL SCORE UPDATE
==================================================
The country's score must NOT instantly change.

Instead:
The score should rapidly roll upward using the same mechanical number-wheel effect.

Example:
643
becomes
955
through a rapid rolling transition.

The user should be able to see the score increasing.
Do not instantly replace the number.
==================================================
POST-SCORE UPDATE RESHUFFLE
==================================================
Only after:
* score collision animation completes
* score update completes
should the leaderboard reshuffle.

Do NOT reshuffle while the score is still updating.
==================================================
LEADERBOARD RESHUFFLE
==================================================
After score update:
Recalculate standings.
Move all affected scoreboard pills simultaneously.
Requirements:
* no jumps
* no teleporting
* no re-render flashes
* no fade-out / fade-in replacement

All affected pills should physically slide to their new positions.
The user must be able to visually follow every movement.
The reshuffle should feel alive.
==================================================
COMPLETED COUNTRY STATE
==================================================
After the reshuffle completes:
The country's televote is considered complete.

IMPORTANT:
Only the points are locked.
The position is NOT locked.

Example:
Country A receives televote.
Country A moves to first place.

Later:
Country B receives more televote.
Country B overtakes Country A.
Country A moves to second place.
This is correct behavior.
==================================================
COMPLETED STATE ANIMATION
==================================================
After reshuffling:
Animate a darker overlay across the pill that just received its televotes.

Animation direction:
Left → Right
The darkening should sweep across the pill.

Purpose:
Indicate that the country's televote has already been processed.
The country will not receive additional points.
==================================================
COMPLETED STATE STYLING
==================================================
Do NOT use:
* lock icons
* padlock graphics
* warning indicators

Instead:
* slightly darker background
* slightly darker text
* slightly reduced visual prominence

The pill should remain readable.
The pill should simply feel "completed."
The user should immediately be able to distinguish:
* countries that have received televote
* countries that have not yet received televote
at a glance.
==================================================
WINNER REVEAL
==================================================
After final televote announcement:
Pause.

Display:
Winner

Animate winner card.
Winner should receive visual emphasis.

Examples:
* larger card that grows and overlays the scoreboard
* glow
* celebration animation

Do not overuse effects.
The winner reveal should feel earned.
==================================================
RESULT FILE REQUIREMENTS
==================================================
Phase 2 should begin consuming additional fields from the already templated results files.
==================================================
PHASE 2 COMPLETION CRITERIA
==================================================
Phase 2 is complete when:
* Eurovision Results Night exists
* Jury voting functions
* Televoting functions
* Scoreboard reshuffles correctly
* Position locking works
* Winner reveal works

WITHOUT:
* YouTube embeds
* Video playback
* Timestamp synchronization

Those belong to Phase 3.