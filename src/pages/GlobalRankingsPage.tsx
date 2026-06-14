import {
  AlertTriangle,
  Check,
  Eye,
  X,
  Info,
  ListRestart,
  Plus,
  RotateCcw,
  Scale,
  Trash2,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  ComparisonFlagBadge,
  ComparisonOverlayChoiceCard,
} from "../components/ComparisonOverlay";
import RankingList from "../components/RankingList";
import { allSongs, allSongsBackground, songsByYear, years } from "../data/years";
import type { GlobalRankingState, Song, YearData } from "../types";
import {
  chooseInsertionWinner,
  comparisonIsComplete,
  createInsertionComparisonState,
} from "../utils/pairing";
import { rankingKeyForStage } from "../utils/contestStages";
import {
  clearGlobalRanking,
  loadFavorites,
  loadGlobalRanking,
  loadRanking,
  saveFavorites,
  saveGlobalRanking,
} from "../utils/storage";

type YearSource = {
  ids: string[];
  appearsDefault: boolean;
};

type Flow =
  | { type: "initialize"; year: YearData }
  | { type: "insert-confirm"; year: YearData; rerank: boolean }
  | { type: "default-warning"; year: YearData; rerank: boolean }
  | { type: "method"; year: YearData; rerank: boolean }
  | { type: "changed"; year: YearData; changes: ChangeReport[] };

type ChangeReport = {
  preferredInGlobal: Song;
  preferredInYear: Song;
};

type ComparisonRun = {
  year: YearData;
  baselineIds: string[];
  pendingIds: string[];
  state: ReturnType<typeof createInsertionComparisonState>;
};

function emptyGlobalRanking(): GlobalRankingState {
  return {
    globalOrder: [],
    insertedYears: [],
    totalSongCount: 0,
    manualAdjustments: [],
    updatedAt: new Date().toISOString(),
  };
}

function arraysMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function orderSongs(songs: Song[], savedIds?: string[]) {
  if (!savedIds?.length) return songs;
  const byId = new Map(songs.map((song) => [song.id, song]));
  const ordered = savedIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const missing = songs.filter((song) => !savedIds.includes(song.id));
  return [...ordered, ...missing];
}

function normalizeGlobalRanking(
  state: GlobalRankingState | null | undefined,
  validIds: Set<string>,
) {
  const now = new Date().toISOString();
  if (!state) return emptyGlobalRanking();

  const seen = new Set<string>();
  const globalOrder = (state.globalOrder ?? []).filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return {
    globalOrder,
    insertedYears: (state.insertedYears ?? [])
      .filter((entry) => songsByYear.has(String(entry.year)))
      .sort((a, b) => b.year - a.year),
    totalSongCount: globalOrder.length,
    manualAdjustments: state.manualAdjustments ?? [],
    updatedAt: state.updatedAt ?? now,
  };
}

function upsertInsertedYear(
  insertedYears: GlobalRankingState["insertedYears"],
  year: number,
) {
  const now = new Date().toISOString();
  const existing = insertedYears.find((entry) => entry.year === year);

  if (existing) {
    return insertedYears.map((entry) =>
      entry.year === year ? { ...entry, updatedAt: now } : entry,
    );
  }

  return [...insertedYears, { year, insertedAt: now }].sort((a, b) => b.year - a.year);
}

function yearIds(year: YearData) {
  return new Set(year.songs.map((song) => song.id));
}

function removeYearIds(ids: string[], year: YearData) {
  const idsForYear = yearIds(year);
  return ids.filter((id) => !idsForYear.has(id));
}

function songLabel(song: Song) {
  return `${song.title} (${song.country})`;
}

function Modal({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="globalModal" role="dialog" aria-modal="true" aria-labelledby="global-modal-title">
      <div className="globalModalBackdrop" />
      <section className="globalDialog">
        <h2 id="global-modal-title">{title}</h2>
        <div className="globalDialogBody">{children}</div>
        <div className="globalDialogActions">{actions}</div>
      </section>
    </div>
  );
}

export default function GlobalRankingsPage() {
  const allSongIds = useMemo(() => new Set(allSongs.map((song) => song.id)), []);
  const songById = useMemo(() => new Map(allSongs.map((song) => [song.id, song])), []);
  const [globalRanking, setGlobalRanking] = useState<GlobalRankingState>(() => emptyGlobalRanking());
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<"landing" | "rankings">("landing");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [insertPickerOpen, setInsertPickerOpen] = useState(false);
  const [comparisonRun, setComparisonRun] = useState<ComparisonRun | null>(null);
  const [comparisonSidebarOpen, setComparisonSidebarOpen] = useState(false);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [resetText, setResetText] = useState("");
  const [dataError, setDataError] = useState("");

  const currentSongs = useMemo(
    () => globalRanking.globalOrder.flatMap((id) => (songById.has(id) ? [songById.get(id)!] : [])),
    [globalRanking.globalOrder, songById],
  );
  const insertedYearSet = useMemo(
    () => new Set(globalRanking.insertedYears.map((entry) => entry.year)),
    [globalRanking.insertedYears],
  );
  const hasGlobalRankings = globalRanking.globalOrder.length > 0;

  useEffect(() => {
    let active = true;

    async function loadState() {
      try {
        const [savedGlobalRanking, savedFavorites] = await Promise.all([
          loadGlobalRanking(),
          loadFavorites(),
        ]);
        if (!active) return;
        setGlobalRanking(normalizeGlobalRanking(savedGlobalRanking, allSongIds));
        setFavorites(savedFavorites);
        setDataError("");
      } catch (error) {
        if (!active) return;
        setDataError(error instanceof Error ? error.message : "Could not load Global Rankings.");
      }
    }

    void loadState();
    return () => {
      active = false;
    };
  }, [allSongIds]);

  useEffect(() => {
    if (!comparisonRun) return;
    document.body.classList.add("comparisonOpen");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setComparisonRun(null);
        return;
      }
      if (event.key === "ArrowLeft" && pairSongs[0]) {
        void chooseComparisonWinner(pairSongs[0].id);
      }
      if (event.key === "ArrowRight" && pairSongs[1]) {
        void chooseComparisonWinner(pairSongs[1].id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("comparisonOpen");
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  async function getYearSource(year: YearData): Promise<YearSource> {
    const ranking = await loadRanking(rankingKeyForStage(String(year.year), "overall"));
    const songs = orderSongs(year.songs, ranking?.songIds);
    const ids = songs.map((song) => song.id);
    const defaultIds = year.songs.map((song) => song.id);

    return {
      ids,
      appearsDefault: !ranking?.songIds?.length || arraysMatch(ids, defaultIds),
    };
  }

  async function persist(next: GlobalRankingState) {
    const normalized = normalizeGlobalRanking(next, allSongIds);
    setGlobalRanking(normalized);
    await saveGlobalRanking(normalized);
    setDataError("");
  }

  function beginYearFlow(year: YearData) {
    setInsertPickerOpen(false);

    if (!hasGlobalRankings) {
      setFlow({ type: "initialize", year });
      return;
    }

    setFlow({
      type: "insert-confirm",
      year,
      rerank: insertedYearSet.has(year.year),
    });
  }

  async function continueAfterConfirm(year: YearData, rerank: boolean) {
    try {
      const source = await getYearSource(year);
      if (source.appearsDefault) {
        setFlow({ type: "default-warning", year, rerank });
        return;
      }
      setFlow({ type: "method", year, rerank });
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not inspect year ranking.");
    }
  }

  async function initializeFromYear(year: YearData, skipDefaultCheck = false) {
    try {
      const source = await getYearSource(year);
      if (source.appearsDefault && !skipDefaultCheck) {
        setFlow({ type: "default-warning", year, rerank: false });
        return;
      }

      await persist({
        ...emptyGlobalRanking(),
        globalOrder: source.ids,
        insertedYears: upsertInsertedYear([], year.year),
      });
      setFlow(null);
      setView("rankings");
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not initialize Global Rankings.");
    }
  }

  async function applyManualPlacement(year: YearData, rerank: boolean) {
    try {
      const source = await getYearSource(year);
      const baseline = rerank ? removeYearIds(globalRanking.globalOrder, year) : globalRanking.globalOrder;

      await persist({
        ...globalRanking,
        globalOrder: [...baseline, ...source.ids],
        insertedYears: upsertInsertedYear(globalRanking.insertedYears, year.year),
      });
      setFlow(null);
      setView("rankings");
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not insert year manually.");
    }
  }

  async function startComparison(year: YearData, rerank: boolean) {
    try {
      const source = await getYearSource(year);
      const baseline = rerank ? removeYearIds(globalRanking.globalOrder, year) : globalRanking.globalOrder;

      if (!baseline.length) {
        await initializeFromYear(year, true);
        return;
      }

      setComparisonRun({
        year,
        baselineIds: baseline,
        pendingIds: source.ids,
        state: createInsertionComparisonState(
          `global:${year.year}:comparison`,
          baseline,
          source.ids,
        ),
      });
      setFlow(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not start comparison insertion.");
    }
  }

  function resetComparisonRun() {
    if (!comparisonRun) return;
    setComparisonRun({
      ...comparisonRun,
      state: createInsertionComparisonState(
        `global:${comparisonRun.year.year}:comparison`,
        comparisonRun.baselineIds,
        comparisonRun.pendingIds,
      ),
    });
  }

  async function chooseComparisonWinner(songId: string) {
    if (!comparisonRun) return;
    const nextState = chooseInsertionWinner(comparisonRun.state, songId);
    setComparisonRun({ ...comparisonRun, state: nextState });

    if (comparisonIsComplete(nextState)) {
      await persist({
        ...globalRanking,
        globalOrder: nextState.sortedIds,
        insertedYears: upsertInsertedYear(globalRanking.insertedYears, comparisonRun.year.year),
      });
      setComparisonRun(null);
      setView("rankings");
    }
  }

  async function showChanged(year: YearData) {
    try {
      const source = await getYearSource(year);
      const globalPositions = new Map(globalRanking.globalOrder.map((id, index) => [id, index]));
      const changes: ChangeReport[] = [];

      for (let leftIndex = 0; leftIndex < source.ids.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < source.ids.length; rightIndex += 1) {
          const leftId = source.ids[leftIndex];
          const rightId = source.ids[rightIndex];
          const leftGlobal = globalPositions.get(leftId);
          const rightGlobal = globalPositions.get(rightId);
          if (leftGlobal === undefined || rightGlobal === undefined) continue;
          if (leftGlobal > rightGlobal) {
            const preferredInGlobal = songById.get(rightId);
            const preferredInYear = songById.get(leftId);
            if (preferredInGlobal && preferredInYear) {
              changes.push({ preferredInGlobal, preferredInYear });
            }
          }
        }
      }

      setFlow({ type: "changed", year, changes });
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not compare rankings.");
    }
  }

  async function reorderGlobal(nextSongs: Song[]) {
    const previousIndex = new Map(globalRanking.globalOrder.map((id, index) => [id, index]));
    const nextIds = nextSongs.map((song) => song.id);
    const adjustment = nextIds
      .map((id, index) => ({ id, fromIndex: previousIndex.get(id) ?? index, toIndex: index }))
      .find((move) => move.fromIndex !== move.toIndex);

    try {
      await persist({
        ...globalRanking,
        globalOrder: nextIds,
        manualAdjustments: adjustment
          ? [
              ...globalRanking.manualAdjustments,
              {
                songId: adjustment.id,
                fromIndex: adjustment.fromIndex,
                toIndex: adjustment.toIndex,
                adjustedAt: new Date().toISOString(),
              },
            ]
          : globalRanking.manualAdjustments,
      });
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not save Global Rankings.");
    }
  }

  async function toggleFavorite(songId: string) {
    const next = new Set(favorites);
    if (next.has(songId)) next.delete(songId);
    else next.add(songId);
    setFavorites(next);
    try {
      await saveFavorites(next);
      setDataError("");
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not save favorite.");
    }
  }

  async function resetGlobalRankings() {
    try {
      await clearGlobalRanking();
      setGlobalRanking(emptyGlobalRanking());
      setResetStep(0);
      setResetText("");
      setView("landing");
      setDataError("");
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Could not reset Global Rankings.");
    }
  }

  const pairSongs = comparisonRun?.state.currentPair
    ? comparisonRun.state.currentPair.flatMap((id) => (songById.has(id) ? [songById.get(id)!] : []))
    : [];
  const comparisonPreviewSongs = comparisonRun
    ? comparisonRun.state.sortedIds.flatMap((id) => (songById.has(id) ? [songById.get(id)!] : []))
    : [];
  const insertedYears = years.filter((year) => insertedYearSet.has(year.year));
  const notInsertedYears = years.filter((year) => !insertedYearSet.has(year.year));

  return (
    <main
      className="pageShell"
      style={{ "--bg-image": `url(${allSongsBackground})` } as CSSProperties}
    >
      <section className="contentColumn">
        <div className="pageHeader">
          <p className="eyebrow">Cross-year leaderboard</p>
          <h1>Global Rankings</h1>
          <p>
            Build one master ranking from the years you have inserted. Year pages remain the source
            for insertion order, while this page becomes the authority after songs are added.
          </p>
        </div>

        <div className="globalStats">
          <section>
            <span>Total songs ranked</span>
            <strong>{currentSongs.length}</strong>
          </section>
          <section>
            <span>Years inserted</span>
            <strong>{globalRanking.insertedYears.length}</strong>
          </section>
          <section>
            <span>Manual adjustments</span>
            <strong>{globalRanking.manualAdjustments.length}</strong>
          </section>
        </div>

        <div className="toolbar">
          <span className="countLine">
            {hasGlobalRankings
              ? `${currentSongs.length} songs in Global Rankings`
              : "Select a starting year to initialize Global Rankings"}
          </span>
          <div className="toolbarActions">
            {view === "rankings" && hasGlobalRankings ? (
              <button
                className="primaryButton"
                type="button"
                disabled={!notInsertedYears.length}
                onClick={() => setInsertPickerOpen(true)}
              >
                <Plus size={17} /> Insert Year
              </button>
            ) : null}
            {view !== "rankings" ? (
              <button
                className="primaryButton"
                type="button"
                disabled={!hasGlobalRankings}
                onClick={() => setView("rankings")}
              >
                <Eye size={17} /> View Current Rankings
              </button>
            ) : null}
            <button
              className="secondaryButton"
              type="button"
              disabled={!hasGlobalRankings}
              onClick={() => setResetStep(1)}
            >
              <Trash2 size={17} /> Reset Global Rankings
            </button>
          </div>
        </div>
        {dataError ? <div className="dataError">{dataError}</div> : null}

        {view === "rankings" && hasGlobalRankings ? (
          <section className="globalRankingsPanel">
            <div className="toolbar">
              <span className="countLine">Current Global Ranking order</span>
              <button className="secondaryButton" type="button" onClick={() => setView("landing")}>
                Back to Years
              </button>
            </div>
            <RankingList
              songs={currentSongs}
              favorites={favorites}
              onToggleFavorite={(songId) => void toggleFavorite(songId)}
              onReorder={(nextSongs) => void reorderGlobal(nextSongs)}
              metaMode="countryYear"
            />
          </section>
        ) : (
          <section className="globalYearsLayout">
            {hasGlobalRankings ? (
              <div className="globalYearPanel">
                <h2>Years Already Inserted</h2>
                <div className="globalYearGrid">
                  {insertedYears.map((year) => (
                    <button
                      className="globalYearButton inserted"
                      type="button"
                      key={year.year}
                      onClick={() => beginYearFlow(year)}
                    >
                      <Check size={16} />
                      <span>{year.year}</span>
                      <small>Re-rank Existing Year</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="globalYearPanel">
              <h2>Years Not Yet Inserted</h2>
              <div className="globalYearGrid">
                {(hasGlobalRankings ? notInsertedYears : years).map((year) => (
                  <button
                    className="globalYearButton"
                    type="button"
                    key={year.year}
                    onClick={() => beginYearFlow(year)}
                  >
                    <Plus size={16} />
                    <span>{year.year}</span>
                    <small>{hasGlobalRankings ? "Add Year" : "Initialize"}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </section>

      {insertPickerOpen ? (
        <Modal
          title="Insert a year"
          actions={
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setInsertPickerOpen(false)}
            >
              Cancel
            </button>
          }
        >
          {notInsertedYears.length ? (
            <>
              <p>
                Select a year that has not been inserted yet. You can start comparison insertion
                from the current rankings page.
              </p>
              <div className="globalYearGrid compactPicker">
                {notInsertedYears.map((year) => (
                  <button
                    className="globalYearButton"
                    type="button"
                    key={year.year}
                    onClick={() => beginYearFlow(year)}
                  >
                    <Plus size={16} />
                    <span>{year.year}</span>
                    <small>Add Year</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>Every available year has already been inserted into Global Rankings.</p>
          )}
        </Modal>
      ) : null}

      {flow?.type === "initialize" ? (
        <Modal
          title={`Initialize with ${flow.year.year}?`}
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={() => setFlow(null)}>
                Cancel
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => void initializeFromYear(flow.year)}
              >
                Continue
              </button>
            </>
          }
        >
          <p>
            The selected year becomes your initial Global Ranking dataset. No comparisons are
            required; the current {flow.year.year} Overall order will be copied.
          </p>
        </Modal>
      ) : null}

      {flow?.type === "insert-confirm" ? (
        <Modal
          title={flow.rerank ? `Re-rank ${flow.year.year}?` : `Insert ${flow.year.year}?`}
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={() => setFlow(null)}>
                Cancel
              </button>
              {flow.rerank ? (
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => void showChanged(flow.year)}
                >
                  Tell Me What's Changed
                </button>
              ) : null}
              <Link className="secondaryButton" to={`/year/${flow.year.year}`}>
                Take Me to My Year's Rankings
              </Link>
              <button
                className="primaryButton"
                type="button"
                onClick={() => void continueAfterConfirm(flow.year, flow.rerank)}
              >
                Continue
              </button>
            </>
          }
        >
          {flow.rerank ? (
            <p>
              The insertion process uses the current ordering from the {flow.year.year} rankings
              page. If you manually adjusted {flow.year.year} songs here but did not update that
              year's Overall ranking, results may differ from expectations.
            </p>
          ) : (
            <p>
              For best results, ensure your {flow.year.year} rankings are finalized in the Overall
              tab before continuing.
            </p>
          )}
        </Modal>
      ) : null}

      {flow?.type === "default-warning" ? (
        <Modal
          title={`${flow.year.year} may need review`}
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={() => setFlow(null)}>
                Cancel
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() =>
                  hasGlobalRankings
                    ? setFlow({ type: "method", year: flow.year, rerank: flow.rerank })
                    : void initializeFromYear(flow.year, true)
                }
              >
                Continue Anyway
              </button>
            </>
          }
        >
          <p>
            It looks like you may not have ranked {flow.year.year} yet. Global Rankings will use the
            current {flow.year.year} Overall order as its{" "}
            {hasGlobalRankings ? "insertion" : "starting"} source.
          </p>
          <p>
            For best results, complete or review your {flow.year.year} Overall ranking before
            inserting this year into Global Rankings. Otherwise, your Global Ranking results may not
            be accurate.
          </p>
        </Modal>
      ) : null}

      {flow?.type === "method" ? (
        <Modal
          title={`How would you like to insert ${flow.year.year}?`}
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={() => setFlow(null)}>
                Cancel
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => void applyManualPlacement(flow.year, flow.rerank)}
              >
                <ListRestart size={16} /> Manual Placement
              </button>
              <button
                className="primaryButton recommendedAction"
                type="button"
                title="Two songs will be shown side-by-side. Select the song you prefer. The system will gradually determine where songs from the selected year belong within your existing Global Rankings. You may optionally preview each song before deciding."
                onClick={() => void startComparison(flow.year, flow.rerank)}
              >
                <Scale size={17} /> Rank By Comparison
              </button>
            </>
          }
        >
          <p className="globalInfoLine">
            <Info size={16} /> Rank By Comparison is recommended for large Global Rankings.
          </p>
        </Modal>
      ) : null}

      {flow?.type === "changed" ? (
        <Modal
          title={`${flow.year.year} ordering differences`}
          actions={
            <>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setFlow({ type: "insert-confirm", year: flow.year, rerank: true })}
              >
                Back
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => void continueAfterConfirm(flow.year, true)}
              >
                Continue
              </button>
            </>
          }
        >
          {flow.changes.length ? (
            <>
              <p>
                These songs have a different relative order in Global Rankings than in the
                {flow.year.year} Overall ranking. Showing the first 20 contradictions.
              </p>
              <ol className="globalChangeList">
                {flow.changes.slice(0, 20).map((change) => (
                  <li key={`${change.preferredInGlobal.id}-${change.preferredInYear.id}`}>
                    Global has <strong>{songLabel(change.preferredInGlobal)}</strong> above{" "}
                    <strong>{songLabel(change.preferredInYear)}</strong>, but the year page has the
                    reverse.
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p>No contradictions were found between this year's Global Rankings order and Overall ranking.</p>
          )}
        </Modal>
      ) : null}

      {resetStep === 1 ? (
        <Modal
          title="Reset all Global Rankings?"
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={() => setResetStep(0)}>
                Cancel
              </button>
              <button className="primaryButton dangerButton" type="button" onClick={() => setResetStep(2)}>
                Continue
              </button>
            </>
          }
        >
          <p>
            This will permanently delete ALL Global Rankings. This action cannot be undone. All
            inserted years, comparisons, and rankings will be lost.
          </p>
          <p>We recommend re-ranking an individual year instead.</p>
        </Modal>
      ) : null}

      {resetStep === 2 ? (
        <Modal
          title="Type CONFIRM to delete"
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={() => setResetStep(0)}>
                Cancel
              </button>
              <button
                className="primaryButton dangerButton"
                type="button"
                disabled={resetText !== "CONFIRM"}
                onClick={() => void resetGlobalRankings()}
              >
                <Trash2 size={17} /> Delete Global Rankings
              </button>
            </>
          }
        >
          <label className="globalConfirmInput">
            Type CONFIRM to permanently delete all Global Rankings.
            <input value={resetText} onChange={(event) => setResetText(event.target.value)} />
          </label>
        </Modal>
      ) : null}

      {comparisonRun ? (
        <div className="comparisonOverlay" role="dialog" aria-modal="true">
          <div className="overlayBackdrop" />
          <div className="comparisonLayer">
            <header className="overlayHeader">
              <div className="overlayTitle">
                <h1>Insert {comparisonRun.year.year}</h1>
                <p>Use ← or → or click Pick. Results save into Global Rankings.</p>
              </div>
              <div className="overlayProgress" aria-label="Comparison progress">
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      (comparisonRun.state.completed /
                        Math.max(comparisonRun.state.targetComparisons, 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
              <div className="overlayHeaderActions">
                <span className="overlayProgressText">
                  {comparisonRun.state.completed} / ~{comparisonRun.state.targetComparisons}
                </span>
                <button
                  className="overlayReset"
                  type="button"
                  onClick={resetComparisonRun}
                  title="Reset comparison"
                >
                  <RotateCcw size={15} /> Reset
                </button>
                <button
                  className="overlayClose"
                  type="button"
                  onClick={() => setComparisonRun(null)}
                  aria-label="Close comparison"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <button
              className="rankingDrawerButton"
              type="button"
              onClick={() => setComparisonSidebarOpen(true)}
            >
              Current Ranking
            </button>
            <main className="overlayMain">
              <div className="compareStage">
                {!comparisonIsComplete(comparisonRun.state) && pairSongs[0] && pairSongs[1] ? (
                  <>
                    <ComparisonOverlayChoiceCard
                      badge="A"
                      song={pairSongs[0]}
                      metaMode="year"
                      onPick={() => void chooseComparisonWinner(pairSongs[0]!.id)}
                    />
                    <div className="versusDivider">
                      <span>VS</span>
                    </div>
                    <ComparisonOverlayChoiceCard
                      badge="B"
                      song={pairSongs[1]}
                      metaMode="year"
                      onPick={() => void chooseComparisonWinner(pairSongs[1]!.id)}
                    />
                  </>
                ) : (
                  <section className="comparisonComplete">
                    <h2>Comparison insertion complete</h2>
                    <p>Global Rankings have been updated with {comparisonRun.year.year}.</p>
                  </section>
                )}
              </div>
              <aside className={`currentRankingPanel ${comparisonSidebarOpen ? "open" : ""}`}>
                <div className="rankingPanelHeader">
                  <div>
                    <h2>Current Ranking</h2>
                    <p>Updates after each pick</p>
                  </div>
                  <button
                    className="overlayClose mobileOnly"
                    type="button"
                    onClick={() => setComparisonSidebarOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <ol className="liveRankingList">
                  {comparisonPreviewSongs.map((song, index) => (
                    <li key={song.id}>
                      <span className="liveRank">{index + 1}</span>
                      <ComparisonFlagBadge song={song} />
                      <div>
                        <strong>{song.title}</strong>
                        <p>
                          {song.artist}
                          {song.year ? ` · ${song.year}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </aside>
            </main>
          </div>
        </div>
      ) : null}

      {dataError && comparisonRun ? (
        <div className="globalFloatingError">
          <AlertTriangle size={16} /> {dataError}
        </div>
      ) : null}
    </main>
  );
}
