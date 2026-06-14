1. Yes, Global Rankings replaces All Songs.
Rename routes, navigation, and references accordingly.

2. Re-ranking a year should remove all songs from that year from the Global Ranking and then reinsert them using the current year-specific Overall Ranking.

3. The "What's Changed?" button should compare the relative ordering of songs from the selected year between Global Rankings and the year's Overall Ranking and report any contradictions.

4. Do NOT fall back to JSON order if a year has not been ranked.
Require a completed Overall Ranking before initialization or insertion.

The app currently always has an order for each year because the Overall tab defaults to the year JSON order. Therefore, we cannot reliably say a year has “not been ranked.”

Instead, detect whether the current saved Overall ranking for that year exactly matches the default JSON order.

If the current Overall ranking appears to match the default JSON order, show a warning:
“It looks like you may not have ranked [YEAR] yet.
Global Rankings will use the current [YEAR] Overall order as its insertion source.
For best results, complete or review your [YEAR] Overall ranking before inserting this year into Global Rankings. Otherwise, your Global Ranking results may not be accurate.”

Buttons:
Cancel
Continue Anyway

This should be a warning only, not a blocker.
If the order differs from the default JSON order, allow the insertion without this warning.

Important:
Do not describe this as certainty.

Use wording like:
* “It looks like…”
* “may not have…”
* “appears to…”
because matching JSON order does not prove the user never ranked it. They may coincidentally agree with the default order.

5. Global Rankings should be treated as its own persistent dataset and source of truth. Existing All Songs behavior should not be reused as the authoritative ranking model.
For first-time initialization or inserting a year into Global Rankings:
Do NOT hard-block years that appear unranked.

Additionally, for the global dataset:
Do not think in terms of:
year + country
at all.

Because eventually you'll run into:
1956 → same country, two songs
alternate spellings
country renames
possible future metadata changes
user imports/exports
song title corrections

The global ranking should never identify a song by its display attributes.
Instead every Eurovision entry should have a stable unique song ID.

Something like:
{
  "id": "1956-switzerland-refrain",
  "year": 1956,
  "country": "Switzerland",
  "song": "Refrain"
}

or even:
{
  "id": "1956-switzerland-1"
}

though I actually prefer the song-title approach if titles are guaranteed unique within a year.

Then Global Rankings becomes:
{
  "globalOrder": [
    "2026-luxembourg-mother-nature",
    "2025-slovenia-how-much-time-do-we-have-left",
    "2026-israel-michelle",
    "1990-yugoslavia-hajde-da-ludujemo"
  ]
}

Not:
[
  {
    "year": 2026,
    "country": "Luxembourg"
  }
]
because then every lookup becomes a nightmare.

In fact, I'd probably say:
Global Rankings should only store IDs

Never store:
{
  "position": 42,
  "country": "Hungary",
  "year": 2018
}

Store:
{
  "songId": "2018-hungary-viszlat-nyar"
}

Then whenever the page loads:
Load global ranking IDs.
Resolve IDs back to song objects using the year data files.
Render.

That gives you:
stable ordering
stable comparisons
stable exports
stable future migrations

And regarding 1956 specifically:
Do not create special handling for 1956.

Instead create IDs that naturally support multiple entries per country.

For example:
{
  "id": "1956-switzerland-refrain"
}
{
  "id": "1956-switzerland-das-alte-karussell"
}

Now 1956 just works.
No special cases.
No appended "1" and "2".
No weird logic.

Because if the ID is based on the actual song entry, not the country, then Eurovision 1956 becomes just another year with multiple songs.

And honestly, I'd first verify whether a stable song ID already exists somewhere in the current model before inventing a new one. Because if ther is already something like:
song.id
being used in rankings, comparisons, drag-and-drop, or storage, then that's what Global Rankings should use too. The worst thing we could do right now is create a second identifier system alongside the one the app already uses.

That said, if we'd prefer to veer away from the JSON file storage altogether (files stored in E:\Users\benut\Documents\GitHub\EurovisionRanker\src\data) and move everything to a new database table or table(s), we should do that now before we have an extensive amount of data.