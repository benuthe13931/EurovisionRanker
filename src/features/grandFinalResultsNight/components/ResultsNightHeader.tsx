import { ResultDelegation } from "../../../types";
import { ActiveResultVideo, EurovisionNightPhase, FinalistResult } from "../types/PredictionsResultsNightProps";

type ResultsNightHeaderProps = {
    phase: EurovisionNightPhase;
    juryIndex: number;
    juryDelegations: ResultDelegation[];
    activeTelevoteSongId?: string | null;
    televoteSongs: FinalistResult[];
    completedTelevoteIds: Set<string>;
    onBackToSetup: () => void;
    onSaveExit: () => void;
    hasTelevote: boolean;
    skipToTelevote: () => void;
    animating: boolean;
    processNextJuryDelegation: () => void;
    autoAdvanceJury: boolean;
    continueAfterJury: () => void;
    beginTelevote: () => void;
    televoteVideoEnabled: boolean;
    processNextTelevote: () => void;
    activeVideo?: ActiveResultVideo | undefined;
    currentTelevoteSong: FinalistResult;
    showStatisticsAction: boolean;
    onShowSummary: () => void;
}
export function ResultsNightHeader({
    phase,
    juryIndex,
    juryDelegations,
    activeTelevoteSongId,
    televoteSongs,
    completedTelevoteIds,
    onBackToSetup,
    onSaveExit,
    hasTelevote,
    skipToTelevote,
    animating,
    processNextJuryDelegation,
    autoAdvanceJury,
    continueAfterJury,
    beginTelevote,
    televoteVideoEnabled,
    processNextTelevote,
    activeVideo,
    currentTelevoteSong,
    showStatisticsAction,
    onShowSummary
}: ResultsNightHeaderProps) {

    const progressText =
        phase === "jury"
            ? `Jury delegation ${Math.min(juryIndex + 1, juryDelegations.length)} / ${juryDelegations.length}`
            : phase === "televote"
                ? `Televote ${Math.max(
                    1,
                    activeTelevoteSongId
                        ? televoteSongs.findIndex((song) => song.id === activeTelevoteSongId) + 1
                        : completedTelevoteIds.size,
                )} / ${televoteSongs.length}`
                : "Preparing results";

    return (
        <div className="resultsNightHeader">
            <strong>{progressText}</strong>
            <div className="resultsNightActions">
                {phase !== "ready" ? (
                    <button
                        className="secondaryButton"
                        type="button"
                        onClick={onBackToSetup}
                    >
                        Back to Results Setup
                    </button>
                ) : null}
                {phase !== "ready" ? (
                    <button
                        className="secondaryButton"
                        type="button"
                        onClick={onSaveExit}
                    >
                        Save & Exit
                    </button>
                ) : null}
                {(phase === "jury" || phase === "jury-complete") && hasTelevote ? (
                    <button
                        className="secondaryButton"
                        type="button"
                        onClick={skipToTelevote}
                    >
                        Skip to Televote
                    </button>
                ) : null}
                {phase === "jury" && !autoAdvanceJury ? (
                    <button
                        className="primaryButton"
                        type="button"
                        disabled={animating}
                        onClick={() => processNextJuryDelegation()}
                    >
                        Next
                    </button>
                ) : null}
                {phase === "jury-complete" ? (
                    <button
                        className="primaryButton"
                        type="button"
                        onClick={continueAfterJury}
                    >
                        Continue
                    </button>
                ) : null}
                {phase === "televote-intro" ? (
                    <button
                        className="primaryButton"
                        type="button"
                        onClick={beginTelevote}
                    >
                        Begin Televote Results
                    </button>
                ) : null}
                {phase === "televote" && !televoteVideoEnabled ? (
                    <button
                        className="primaryButton"
                        type="button"
                        disabled={animating}
                        onClick={processNextTelevote}
                    >
                        Next
                    </button>
                ) : null}
                {phase === "televote" &&
                    televoteVideoEnabled &&
                    !activeVideo &&
                    currentTelevoteSong ? (
                    <button
                        className="primaryButton"
                        type="button"
                        disabled={animating}
                        onClick={beginTelevote}
                    >
                        Continue Televote Results
                    </button>
                ) : null}
                {phase === "winner" && showStatisticsAction ? (
                    <button
                        className="primaryButton"
                        type="button"
                        onClick={onShowSummary}
                    >
                        Show Statistics
                    </button>
                ) : null}
            </div>
        </div>
    );
}
