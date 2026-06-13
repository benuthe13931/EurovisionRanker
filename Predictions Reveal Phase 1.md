GRAND FINAL PREDICTION RESULTS REVEAL

CONTEXT
Grand Final Prediction creation is already complete.

Users can already:
* Arrange finalists into predicted order.
* Lock their prediction.

This task begins immediately AFTER a prediction has been locked.

DO NOT modify prediction creation.
DO NOT modify drag-and-drop ordering.
DO NOT modify prediction storage.

Only implement the results reveal experience.
==================================================
POST-LOCK FLOW
==================================================
Current State:

User clicks:
Lock Prediction
Prediction is saved.

Currently the application displays:
"Official final placements are not available for this contest yet."

Replace this flow.
==================================================
RESULTS AVAILABLE CHECK
==================================================
If no official results exist:

Continue showing:
"Official final placements are not available for this contest yet."
No change.

If official results exist:
Display:
Reveal Results
==================================================
REVEAL MODE SELECTION
==================================================
When Reveal Results is clicked:
Show modal.

Title:
Choose Reveal Experience
Options:
( ) Instant Results
Description: Immediately reveal all placements and statistics.

( ) Step-by-Step Reveal
Description: Reveal placements individually with suspense.

Future Option (disabled):
( ) Eurovision Results Night
Coming Soon

Do not implement Eurovision Results Night in this task.

Store user selection.
##################################################
1. INSTANT RESULTS MODE
##################################################
Immediately reveal final placements (with animation).

Layout:
Two-column scoreboard. 50/50 layout. If an uneven number of finalists the left side should have the one additional

Purpose:
Allow the entire contest result to be visible at once.

No scrolling should be required on typical desktop screens.

REVEAL ANIMATION
Countries should not simply appear.

Animate:
Last Place
then
Second Last
then
Third Last
...continuing toward First Place.

Each card:
1. Slide into position
2. Slightly pass the final right-side alignment where it will finish
3. Slide slightly backward (left) into final position
Think boomerang

Do not reveal all cards simultaneously.
This will, however, be a continuous animation from last to first without pauses.
As each card begins the animation in, you can begin the next one's animation in when the previous one has moved roughly 1/2 way through its inward animation.
==================================================
VISUAL HIERARCHY
==================================================
Top 3 placements should stand out.

1st Place:
Largest card
2nd Place:
Medium-large card
3rd Place:
Medium card
4th+:
Standard card

The winner (and 2nd and 3rd place) should immediately draw attention.
==================================================
PREDICTION COMPARISON
==================================================
Each country card should display (in addition to the standard information such as song title/artist/country/etc.):

Predicted Placement
Actual Placement
Difference

Example:
Predicted: 8th
Actual: 3rd
Difference: +5

Positive and negative prediction should be visually obvious.
==================================================
FINAL SUMMARY
==================================================
After winner revealed display a show statistics button.

Upon button press:
Display:
Prediction Summary

Metrics:
Winner Prediction Correct
Exact Placements Correct
Average Placement Error
Largest Overestimate
Largest Underestimate

Examples:
Predicted Sweden 3rd
Actual 19th
Difference: 16
and
Predicted Croatia 18th
Actual 4th
Difference: 14

##################################################
2. STEP-BY-STEP MODE
##################################################
Purpose:
Create suspense.

INITIAL STATE
No placements shown.

Display:
Reveal Next Placement

Button.
==================================================
REVEAL ORDER
==================================================
Reveal:

Last Place
↑
toward Winner

One placement per click.

Example:
Click
Reveal 26th
Click
Reveal 25th
Click
Reveal 24th

Continue until winner.
==================================================
PLACEMENT REVEAL ANIMATION
==================================================
Each reveal should:

1. Display placement.
2. Animate card into scoreboard.
3. Display prediction comparison.
4. Update statistics.
5. Wait for next click.

The animation itself should be similar to the instant one:
1. Slide into position
2. Slightly pass the final right-side alignment where it will finish
3. Slide slightly backward (left) into final position
Think boomerang

Do not auto-advance.
==================================================
PREDICTION COMPARISON
==================================================
Each country card should display (in addition to the standard information such as song title/artist/country/etc.):

Predicted Placement
Actual Placement
Difference

Example:
Predicted: 8th
Actual: 3rd
Difference: +5

Positive and negative prediction should be visually obvious.
==================================================
LIVE STATISTICS
==================================================
Statistics should update after every reveal.

Display:
Exact Predictions
Average Placement Error
Current Accuracy

Example:
Exact Predictions: 3
Average Error: 4.2
==================================================
FINAL SUMMARY
==================================================
After winner revealed display a show statistics button.

Upon button press:
Display:
Prediction Summary

Metrics:
Winner Prediction Correct
Exact Placements Correct
Average Placement Error
Largest Overestimate
Largest Underestimate

Examples:
Predicted Sweden 3rd
Actual 19th
Difference: 16
and
Predicted Croatia 18th
Actual 4th
Difference: 14
==================================================
ANIMATION REQUIREMENTS
==================================================
No instant rendering.
No re-render jumps.
No flashing.
Cards should move smoothly.
Transitions should feel deliberate.
The reveal experience should prioritize suspense over speed.
The user should feel like results are unfolding rather than being displayed.