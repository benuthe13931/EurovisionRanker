##################################################
RESULT DATA ARCHITECTURE
##################################################
IMPORTANT
Do NOT create database tables.
Do NOT create migrations.
Do NOT introduce any backend dependencies.

Eurovision results data should remain file-based and follow the same architecture currently used for yearly contest data.

The results reveal system should load official contest results from JSON files.
==================================================
DIRECTORY STRUCTURE
==================================================
Current:
src/
└── data/
└── years/
├── 1956.json
├── 1957.json
├── 2018.json
└── ...

Add:
src/
└── data/
└── results/
├── 1956-results.json
├── 1957-results.json
├── 2018-results.json
└── ...

Year files contain:
* Songs
* Artists
* Running order
* Contest metadata

Result files contain:
* Official placements
* Official points
* Jury reveal information
* Televote reveal information
* Future video metadata

These concerns should remain completely separate.
==================================================
RESULT FILE DESIGN
==================================================
The country result object should be the single source of truth.
Do NOT create separate placement arrays.
Do NOT duplicate country information across multiple structures.
Every country's official result data should live within its own country object.

Example:
{
"year": 2018,

"televote": {
"url": "",
"beginTimestamp": null,
"endTimestamp": null
},

"countries": [
{
"country": "Israel",

```
  "placement": 1,

  "totalPoints": 529,
  "juryPoints": 212,
  "televotePoints": 317,

  "jury": {
    "url": "",
    "delegationStartTime": null,
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
```
]
}

==================================================
PHASE 1 REQUIRED FIELDS
==================================================
Phase 1 only requires:
{
"year": 2018,

"countries": [
{
"country": "Israel",
"placement": 1
}
]
}

The reveal system should only depend on:
* year
* country
* placement

for this phase.
==================================================
PHASE 2 FIELDS
==================================================
The following fields are not required yet.
However, the architecture should anticipate them.

Country-level fields:
* totalPoints
* juryPoints
* televotePoints

These will be used for:
* scoreboard rendering
* prediction accuracy
* Eurovision Results Night
==================================================
JURY DATA
==================================================
Each country may eventually contain jury delegation information.

Example:
"jury": {
"url": "",
"delegationStartTime": null,
"twelvePointTimestamp": null,
"delegationEndTime": null,
"votesAwarded": []
}

Purpose:
* jury replay clips
* 12 point reveal clips
* scoreboard simulation

The jury clip is country-specific.
Every voting country may have its own delegation clip.
==================================================
TELEVOTE DATA
==================================================
Unlike jury clips, televote clips are NOT country-specific.
The televote sequence is one continuous segment.
Therefore televote metadata belongs at the contest level.

Example:
"televote": {
"url": "",
"beginTimestamp": null,
"endTimestamp": null
}

Purpose:
* televote replay
* televote simulation
* Eurovision Results Night
==================================================
POINTS ANNOUNCEMENT TIMESTAMP
==================================================
Each country may eventually contain:
"pointsAnnouncedAt": null

This represents:
The exact timestamp within the televote segment where that country's televote score is announced.
This is NOT a clip start time.
This is NOT a clip end time.
It is simply a marker within the larger televote sequence.

Example:
If the televote clip begins at:
01:00:00
and Sweden receives televote points at:
01:05:43

then:
"pointsAnnouncedAt": 3943

(or whatever timestamp format is ultimately chosen)

This field will be used to:
* synchronize televote playback
* trigger scoreboard updates
* animate score changes
* lock placements after announcement
==================================================
FUTURE COMPATIBILITY
==================================================
Phase 1 should only use:
* placement

However the data model should be designed so that future phases can add:
* Jury voting simulation
* Televote simulation
* Delegation clips
* Scoreboard animations
* Eurovision Results Night
* Historical replay functionality
without requiring a redesign of the JSON structure.

The goal is to establish the final long-term data model now, even if many fields remain unused until future phases.