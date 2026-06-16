import {
  Camera,
  Clock,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComparisonStatus, RankingSnapshot, Song } from "../types";
import {
  createRankingSnapshot,
  deleteRankingSnapshot,
  loadComparisonStatus,
  loadRankingSnapshots,
  saveRanking,
} from "../utils/storage";
import { exportRankingCsv, exportRankingHtml } from "../utils/exportRankings";
import RankingList from "./RankingList";

type Props = {
  rankingKey: string;
  songs: Song[];
  sourceSongs: Song[];
  title: string;
  exportSectionOptions?: {
    id: string;
    label: string;
    getSongs: () => Promise<Song[]> | Song[];
  }[];
  favorites: Set<string>;
  metaMode?: "country" | "year" | "countryYear";
  onToggleFavorite?: (songId: string) => void;
  onRestore: (songs: Song[]) => void;
  onPersistRestore?: (songs: Song[], snapshot: RankingSnapshot) => Promise<void>;
  onError: (message: string) => void;
  refreshKey?: number | string;
};

type ModalMode = "create" | "view" | "restore" | "delete" | null;
type ExportTarget = "current" | "snapshot" | null;

function formatDate(value?: string | null) {
  if (!value) return "Not completed";
  const date = new Date(value);
  const day = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(date);
  return `${day} • ${time}`;
}

function orderSongs(sourceSongs: Song[], songIds: string[]) {
  const byId = new Map(sourceSongs.map((song) => [song.id, song]));
  return songIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

export function ComparisonStatusLine({
  rankingKey,
  refreshKey = 0,
}: {
  rankingKey: string;
  refreshKey?: number;
}) {
  const [status, setStatus] = useState<ComparisonStatus | null>(null);

  useEffect(() => {
    let active = true;
    loadComparisonStatus(rankingKey)
      .then((next) => {
        if (active) setStatus(next ?? null);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, [rankingKey, refreshKey]);

  return (
    <span className={status ? "comparisonStatus complete" : "comparisonStatus"}>
      Status:{" "}
      {status
        ? `Last Completed ${formatDate(status.completedAt)}`
        : "Not completed"}
    </span>
  );
}

export default function RankingSnapshotControls({
  rankingKey,
  songs,
  sourceSongs,
  title,
  exportSectionOptions,
  favorites,
  metaMode,
  onToggleFavorite,
  onRestore,
  onPersistRestore,
  onError,
  refreshKey = 0,
}: Props) {
  const [snapshots, setSnapshots] = useState<RankingSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<ModalMode>(null);
  const [exportTarget, setExportTarget] = useState<ExportTarget>(null);
  const [selectedExportSectionIds, setSelectedExportSectionIds] = useState<
    string[]
  >([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedId) ?? null,
    [selectedId, snapshots],
  );
  const snapshotSongs = selectedSnapshot
    ? orderSongs(sourceSongs, selectedSnapshot.songIds)
    : [];

  async function refreshSnapshots() {
    try {
      const next = await loadRankingSnapshots(rankingKey);
      setSnapshots(next);
      setSelectedId((current) => current || next[0]?.id || "");
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not load snapshots.",
      );
    }
  }

  useEffect(() => {
    void refreshSnapshots();
  }, [rankingKey, refreshKey]);

  useEffect(() => {
    if (!mode && !exportTarget) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMode(null);
        setExportTarget(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, exportTarget]);

  function closeOverlays() {
    setMode(null);
    setExportTarget(null);
  }

  async function handleCreate() {
    try {
      const created = await createRankingSnapshot(
        rankingKey,
        songs.map((song) => song.id),
        { name, notes },
      );
      setName("");
      setNotes("");
      setMode(null);
      const next = await loadRankingSnapshots(rankingKey);
      setSnapshots(next);
      setSelectedId(created.id);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not create snapshot.",
      );
    }
  }

  async function handleRestore() {
    if (!selectedSnapshot) return;
    const restoredSongs = orderSongs(sourceSongs, selectedSnapshot.songIds);
    const restoredIds = restoredSongs.map((song) => song.id);
    const missing = sourceSongs.filter((song) => !restoredIds.includes(song.id));
    const nextSongs = [...restoredSongs, ...missing];
    try {
      if (onPersistRestore) {
        await onPersistRestore(nextSongs, selectedSnapshot);
      } else {
        await saveRanking(rankingKey, nextSongs.map((song) => song.id));
      }
      onRestore(nextSongs);
      setMode(null);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not restore snapshot.",
      );
    }
  }

  async function handleDelete() {
    if (!selectedSnapshot) return;
    try {
      await deleteRankingSnapshot(rankingKey, selectedSnapshot.id);
      setMode(null);
      setSelectedId("");
      await refreshSnapshots();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not delete snapshot.",
      );
    }
  }

  const currentExportOptions =
    exportSectionOptions?.length
      ? exportSectionOptions
      : [
          {
            id: "current",
            label: "Current Ranking",
            getSongs: () => songs,
          },
        ];

  async function currentExportSections() {
    const selectedIds = selectedExportSectionIds.length
      ? selectedExportSectionIds
      : currentExportOptions.map((option) => option.id);
    const selectedOptions = currentExportOptions.filter((option) =>
      selectedIds.includes(option.id),
    );

    return Promise.all(
      selectedOptions.map(async (option) => ({
        title: option.label,
        songs: await option.getSongs(),
      })),
    );
  }

  function selectedSnapshotExportSections() {
    if (!selectedSnapshot) return [];
    return [
      {
        title: selectedSnapshot.name,
        createdAt: selectedSnapshot.createdAt,
        notes: selectedSnapshot.notes,
        songs: snapshotSongs,
      },
    ];
  }

  async function runExport(format: "html" | "csv" | "both") {
    const isSnapshot = exportTarget === "snapshot";
    const exportTitle =
      isSnapshot && selectedSnapshot
        ? `${title} - ${selectedSnapshot.name}`
        : title;
    const sections = isSnapshot
      ? selectedSnapshotExportSections()
      : await currentExportSections();

    if (!sections.length) return;
    if (format === "html" || format === "both") {
      exportRankingHtml(exportTitle, sections);
    }
    if (format === "csv" || format === "both") {
      exportRankingCsv(exportTitle, sections);
    }
    setExportTarget(null);
  }

  function exportAllSnapshotsCsv() {
    exportRankingCsv(
      `${title} - All Snapshots`,
      snapshots.map((snapshot) => ({
        title: snapshot.name,
        createdAt: snapshot.createdAt,
        notes: snapshot.notes,
        songs: orderSongs(sourceSongs, snapshot.songIds),
      })),
    );
  }

  return (
    <>
      <button
        className="secondaryButton"
        type="button"
        onClick={() => setMode("create")}
      >
        <Camera size={17} /> Create Snapshot
      </button>
      <button
        className="secondaryButton"
        type="button"
        disabled={!snapshots.length}
        onClick={() => {
          void refreshSnapshots();
          setMode("view");
        }}
      >
        <Clock size={17} /> View Snapshots
      </button>
      <button
        className="secondaryButton"
        type="button"
        onClick={() => {
          setSelectedExportSectionIds(
            currentExportOptions.map((option) => option.id),
          );
          setExportTarget("current");
        }}
      >
        <Download size={17} /> Export
      </button>

      {mode ? (
        <div
          className="globalModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-modal-title"
        >
          <button
            className="globalModalBackdrop"
            type="button"
            aria-label="Close"
            onClick={closeOverlays}
          />
          <section className="globalDialog snapshotDialog">
            <button
              className="snapshotCloseButton"
              type="button"
              onClick={closeOverlays}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            {mode === "create" ? (
              <>
                <h2 id="snapshot-modal-title">Save Ranking Snapshot</h2>
                <div className="globalDialogBody">
                  <label className="snapshotField">
                    Snapshot Name optional
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={`Snapshot #${snapshots.length + 1}`}
                    />
                  </label>
                  <label className="snapshotField">
                    Notes optional
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                    />
                  </label>
                </div>
                <div className="globalDialogActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => setMode(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primaryButton"
                    type="button"
                    onClick={() => void handleCreate()}
                  >
                    Create Snapshot
                  </button>
                </div>
              </>
            ) : null}

            {mode === "view" ? (
              <>
                <h2 id="snapshot-modal-title">Ranking Snapshots</h2>
                <div className="snapshotToolbar">
                  <div className="snapshotList" role="listbox" aria-label="Saved snapshots">
                    {snapshots.map((snapshot) => (
                      <button
                        className={
                          snapshot.id === selectedId ? "selected" : ""
                        }
                        key={snapshot.id}
                        type="button"
                        role="option"
                        aria-selected={snapshot.id === selectedId}
                        onClick={() => setSelectedId(snapshot.id)}
                      >
                        <strong>{snapshot.name}</strong>
                        <span>{formatDate(snapshot.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="secondaryButton"
                    type="button"
                    disabled={!selectedSnapshot}
                    onClick={() => setExportTarget("snapshot")}
                  >
                    <Download size={16} /> Export Snapshot
                  </button>
                  <button
                    className="secondaryButton"
                    type="button"
                    disabled={!snapshots.length}
                    onClick={exportAllSnapshotsCsv}
                  >
                    <FileSpreadsheet size={16} /> Export All CSV
                  </button>
                  <button
                    className="secondaryButton"
                    type="button"
                    disabled={!selectedSnapshot}
                    onClick={() => setMode("restore")}
                  >
                    <RotateCcw size={16} /> Restore Snapshot
                  </button>
                  <button
                    className="secondaryButton"
                    type="button"
                    disabled={!selectedSnapshot}
                    onClick={() => setMode("delete")}
                  >
                    <Trash2 size={16} /> Delete Snapshot
                  </button>
                </div>
                {selectedSnapshot ? (
                  <div className="snapshotMeta">
                    <strong>{selectedSnapshot.name}</strong>
                    <span>{formatDate(selectedSnapshot.createdAt)}</span>
                    {selectedSnapshot.notes ? (
                      <p>{selectedSnapshot.notes}</p>
                    ) : null}
                  </div>
                ) : null}
                <RankingList
                  songs={snapshotSongs}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite ?? (() => undefined)}
                  onReorder={() => undefined}
                  metaMode={metaMode}
                  readOnly
                />
                <div className="globalDialogActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => setMode(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}

            {mode === "restore" ? (
              <>
                <h2 id="snapshot-modal-title">Restore Snapshot?</h2>
                <div className="globalDialogBody">
                  <p>
                    You are about to restore this saved ranking snapshot. This
                    will replace your current ranking for this context. You may
                    want to save a snapshot of your current ranking first.
                  </p>
                </div>
                <div className="globalDialogActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => setMode("view")}
                  >
                    Cancel
                  </button>
                  <button
                    className="primaryButton"
                    type="button"
                    onClick={() => void handleRestore()}
                  >
                    Restore Snapshot
                  </button>
                </div>
              </>
            ) : null}

            {mode === "delete" ? (
              <>
                <h2 id="snapshot-modal-title">Delete Snapshot?</h2>
                <div className="globalDialogBody">
                  <p>This saved snapshot will be permanently deleted.</p>
                </div>
                <div className="globalDialogActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => setMode("view")}
                  >
                    Cancel
                  </button>
                  <button
                    className="primaryButton dangerButton"
                    type="button"
                    onClick={() => void handleDelete()}
                  >
                    Delete Snapshot
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
      {exportTarget ? (
        <div
          className="globalModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
        >
          <button
            className="globalModalBackdrop"
            type="button"
            aria-label="Close"
            onClick={closeOverlays}
          />
          <section className="globalDialog">
            <button
              className="snapshotCloseButton"
              type="button"
              onClick={closeOverlays}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 id="export-modal-title">Export Format</h2>
            <div className="globalDialogBody">
              <p>Choose which file format you want to download.</p>
              {exportTarget === "current" && currentExportOptions.length > 1 ? (
                <fieldset className="exportChecklist">
                  <legend>Rankings to include</legend>
                  {currentExportOptions.map((option) => (
                    <label key={option.id}>
                      <input
                        type="checkbox"
                        checked={selectedExportSectionIds.includes(option.id)}
                        onChange={(event) => {
                          setSelectedExportSectionIds((current) =>
                            event.target.checked
                              ? [...current, option.id]
                              : current.filter((id) => id !== option.id),
                          );
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </div>
            <div className="globalDialogActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setExportTarget(null)}
              >
                Cancel
              </button>
              <button
                className="secondaryButton"
                type="button"
                disabled={
                  exportTarget === "current" &&
                  selectedExportSectionIds.length === 0
                }
                onClick={() => void runExport("csv")}
              >
                CSV
              </button>
              <button
                className="secondaryButton"
                type="button"
                disabled={
                  exportTarget === "current" &&
                  selectedExportSectionIds.length === 0
                }
                onClick={() => void runExport("html")}
              >
                HTML
              </button>
              <button
                className="primaryButton"
                type="button"
                disabled={
                  exportTarget === "current" &&
                  selectedExportSectionIds.length === 0
                }
                onClick={() => void runExport("both")}
              >
                Both
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
