FIX VIDEO SYNCHRONIZATION FOR EUROVISION RESULTS NIGHT

CONTEXT
The Eurovision Results Night feature currently supports optional embedded YouTube videos for jury and televote reveal flows.

The current implementation schedules reveal animations using wall-clock timers such as:
(timestamp - startTimestamp) * 1000

This is incorrect.
It causes desynchronization whenever the YouTube video:

* buffers
* starts slowly
* pauses
* stalls
* seeks
* loads late
* plays on a slower device

Example problem:
The code schedules the 12-point animation for 15 seconds after the page starts.
However, if the YouTube video buffers for 4 seconds, the animation fires while the video is still 4 seconds behind.
The animation should be tied to the video's actual playback time, not elapsed browser time.

GOAL
Refactor video-based reveal timing so that all video-synchronized events trigger based on the YouTube player's actual current playback position.
Use the YouTube IFrame Player API.

Events should trigger when:
player.getCurrentTime() >= configuredTimestamp

NOT when:
setTimeout(timestampDifference)
finishes.

IMPORTANT
Do NOT rewrite the entire Predictions panel.
Do NOT refactor unrelated UI.
Do NOT change the scoring logic.
Do NOT change the animation logic.
Do NOT change the reveal state machine except where necessary for video timing.

This task is only about replacing wall-clock video synchronization with playback-position synchronization.
==================================================
WHY THIS IS NEEDED
==================
The existing timing model assumes:
Video start time + elapsed JavaScript time = actual playback position
That assumption is false.
YouTube embeds can buffer.

When buffering happens:
* JavaScript timers continue
* video playback pauses
* reveal animations fire too early

The correct model is:
Actual YouTube playback position controls reveal events.
==================================================
REQUIRED BEHAVIOR
=================
For any reveal event tied to a video timestamp:
* Jury 12-point reveal
* Jury delegation end
* Televote score announcement
* Televote segment end
the code must monitor actual YouTube playback time.

Do not schedule these events using setTimeout based only on timestamp differences.

Instead:
1. Start the YouTube video at the configured start timestamp.
2. Poll or monitor player.getCurrentTime().
3. Trigger each reveal when player.getCurrentTime() reaches the configured timestamp.
4. Ensure each event triggers only once.
5. Stop monitoring after the relevant segment ends.
==================================================
YOUTUBE PLAYER API
==================
Use the YouTube IFrame Player API.
The video component should expose access to the player instance or provide callbacks/utilities that allow the Results Night component to monitor current playback time.

The relevant API method is:
player.getCurrentTime()

This returns the actual current playback position of the video in seconds.
This value should pause naturally when the video buffers or pauses.
Therefore it is the correct clock for synchronization.
==================================================
DO NOT USE WALL-CLOCK TIMERS FOR VIDEO EVENTS
=============================================
Find existing video timing logic that does things like:

setTimeout(() => {
runTelevoteAnimation(song, index);
}, (announcedAt - begin) * 1000);

or:
const twelveRevealDelay =
RESULTS_VIDEO_LEAD_IN_MS + Math.max(0, (twelveAt - start) * 1000);

schedule(() => {
setCenterTwelve(...);
}, twelveRevealDelay);

These are wall-clock timers.
Replace this pattern for video-synchronized events.

Wall-clock timers may still be used for short UI animation delays after an event has already been triggered.
Example:
Allowed:
A reveal event triggers because player.getCurrentTime() reached 1523.
Then a 500ms setTimeout is used to delay the next animation step.

Not allowed:
A reveal event triggers because 1523 seconds minus start time elapsed in JavaScript time.
==================================================
JURY VIDEO SYNCHRONIZATION
==========================
For jury video mode:

Relevant timestamps:
* delegationStartTime
* twelvePointTimestamp
* twelvePointAnnouncementStartTime
* delegationEndTime

The video should seek to delegationStartTime or twelvePointTimestamp, depending on user's selection in the settings.
The 1 through 10 point local scoreboard animations may still start immediately after the video begins, as currently designed.

However:
The special center-screen +12 animation must be triggered using actual playback time.

Correct behavior:
When player.getCurrentTime() >= twelvePointAnnouncementStartTime:
* trigger the special +12 animation
* fly +12 into the receiving country's score
* update score
* reshuffle scoreboard

Do not calculate:
(twelvePointAnnouncementStartTime - delegationStartTime) * 1000
or
(twelvePointAnnouncementStartTime - twelvePointTimestamp) * 1000
to determine when to trigger +12.

The delegation should complete when:
player.getCurrentTime() >= delegationEndTime

At that point:
* pause/stop monitoring
* pause the video if needed
* enable/display the Next Delegation button

Do not enable Next Delegation based only on elapsed wall-clock time.
==================================================
TELEVOTE VIDEO SYNCHRONIZATION
==============================
For televote video mode:

Relevant timestamps:
* televote.beginTimestamp
* televote.endTimestamp
* each country's pointsAnnouncedAt

The video should seek to televote.beginTimestamp.
The televote video should continue playing as one continuous segment.
Do not split the televote into separate clips.
Do not require the user to press Next between countries.

Each country's televote animation should trigger when actual playback time reaches that country's pointsAnnouncedAt.

Correct behavior:
When player.getCurrentTime() >= pointsAnnouncedAt:

* highlight the relevant country pill if not already highlighted
* begin the existing center-screen televote score animation
* apply points
* reshuffle scoreboard
* apply completed-state styling

Do not schedule these using:
(pointsAnnouncedAt - beginTimestamp) * 1000

The televote phase should end when:
player.getCurrentTime() >= televote.endTimestamp

At that point:
* stop monitoring
* clear active video if appropriate
* move to winner phase using existing logic
==================================================
EVENT TRIGGERING RULES
======================
Each timestamped event must trigger exactly once.
Use a set/ref/state structure to track fired events.

Examples:
* firedJuryTwelve = true
* firedTelevoteSongIds = Set<string>
* firedTelevoteEnd = true

Do not allow repeated triggering on every polling cycle after the timestamp has passed.
==================================================
POLLING STRATEGY
================
Use either:
* requestAnimationFrame loop
* setInterval polling

Preferred:
requestAnimationFrame while video is active

Acceptable:
setInterval every 100ms-250ms

The polling loop should:
1. Check whether a video player exists.
2. Call player.getCurrentTime().
3. Compare current time against pending timestamps.
4. Trigger due events.
5. Stop when the segment is complete or video mode exits.

Do not keep polling forever after the video segment ends.

Clean up polling on:
* component unmount
* phase change
* active video change
* reveal reset

==================================================
BUFFERING AND PAUSING
=====================
If the video buffers:

* player.getCurrentTime() should stop advancing.
* reveal events should not fire early.

If the user pauses the video:
* reveal events should pause naturally.
* no additional logic should be needed beyond using getCurrentTime().

If the user seeks past a timestamp:
* any skipped due events should trigger once the polling loop sees currentTime >= that timestamp.
* If multiple events are now due, process them in chronological order if practical.
==================================================
RESULT NIGHT VIDEO COMPONENT
============================
If the current ResultNightVideo component is only rendering an iframe without exposing the YouTube player instance, update it minimally.
Do not perform a large refactor.

The component should support one of the following:
Option A:
Accept an onPlayerReady callback:
<ResultNightVideo
...
onPlayerReady={(player) => setVideoPlayer(player)}
/>

Option B:
Accept an onTimeUpdate callback:
<ResultNightVideo
...
onTimeUpdate={(currentTime) => handleVideoTime(currentTime)}
/>

Option C:
Expose a small imperative handle using forwardRef.

Choose whichever option best fits the existing code with the smallest safe diff.
The key requirement is that EurovisionResultsNight can synchronize events using actual playback time.
==================================================
TYPE SAFETY
===========
If YouTube IFrame API types are missing:
Add minimal local TypeScript types.
Do not use any everywhere.

Example shape:
type YouTubePlayer = {
getCurrentTime: () => number;
seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
pauseVideo?: () => void;
playVideo?: () => void;
};

Use the smallest type surface required for this task.
==========================================================
WALL-CLOCK TIMERS ARE STILL ALLOWED FOR UI ANIMATION STEPS
==========================================================
This is important.
Do not remove all setTimeout usage.
Some timers are still valid.

Allowed:
* staggered score animations
* award fade-outs
* score collision delays
* center number hold time
* reshuffle delay after score update

Not allowed:
* deciding when a video timestamp has been reached
* deciding when the 12-point video moment occurs
* deciding when a televote announcement occurs
* deciding when the video segment is over

Rule:
Video synchronization uses video playback time.
Animation sequencing after a sync event may use short wall-clock timers.
==================================================
EXAMPLE DESIRED FLOW: JURY
==========================
1. User clicks Next Delegation.
2. Video loads and seeks to delegationStartTime or twelvePointTimestamp.
3. 1-10 point local animations begin as currently designed.
4. Polling watches player.getCurrentTime().
5. When currentTime >= twelvePointAnnouncementStartTime:
   * trigger center +12 animation
   * apply 12 points
   * wait 1-1.5 seconds
   * reshuffle
6. Continue polling.
7. When currentTime >= delegationEndTime:
   * stop polling
   * pause video
   * allow user to continue.

Note: This should already be most of the implemented behavior. All animation logic should remain untouched. The only adjustment animation wise is now waiting 1.5 seconds before reshuffling the scoreboard once points are delegated and updated to allow the user to see and process the new totals before moving everything. This is simply correcting how timestamps are being read and processed to enhance user experience by avoiding unsynchronized climax vote reveals.
==================================================
EXAMPLE DESIRED FLOW: TELEVOTE
==============================
1. User clicks Begin Televote Results.
2. Video loads and seeks to televote.beginTimestamp.
3. Polling watches player.getCurrentTime().
4. When currentTime >= first country's pointsAnnouncedAt:
   * trigger existing televote animation for that country
5. Video continues.
6. When currentTime >= next country's pointsAnnouncedAt:
   * trigger existing televote animation for that country
7. Continue until all countries processed.
8. When currentTime >= televote.endTimestamp:
   * stop polling
   * proceed to winner phase.
==================================================
SUCCESS CRITERIA
================
This task is complete when:

* Buffering no longer causes reveal animations to fire early.
* Jury +12 reveal is synchronized to actual video playback position.
* Jury delegation completion is synchronized to actual video playback position.
* Televote point reveals are synchronized to actual video playback position.
* Televote completion is synchronized to actual video playback position.
* Existing non-video reveal mode still works.
* Existing animations still work.
* No large unrelated refactor is performed.
==================================================
NON-GOALS
=========
Do NOT:
* redesign the results UI
* rewrite the Predictions panel
* change the data model
* change ranking logic
* change prediction logic

This is a targeted synchronization fix only.