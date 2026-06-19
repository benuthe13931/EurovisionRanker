import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import FlagEmoji from "../../../components/FlagEmoji";
import { useResponsive } from "../../../hooks/useDisplayType";
import "../styles/ScoreboardCards.css";
import { AwardAnimation, FinalistResult, ScoreboardSnapshot } from "../types/PredictionsResultsNightProps";

function smoothScoreProgress(progress: number) {
    return 1 - Math.pow(1 - progress, 5);
}

type ResultNightScoreboardProps = {
    songs: FinalistResult[];
    scores: ScoreboardSnapshot;
    awards: AwardAnimation[];
    activeSongId?: string;
    highlightedSongIds: Set<string>;
    settledHighlightSongIds: Set<string>;
    resettingSongIds: Set<string>;
    slowRollingSongId?: string;
    slowRollingDurationMs?: number;
    completedSongIds: Set<string>;
    winnerSongId?: string;
    registerCard: (songId: string, node: HTMLElement | null) => void;
}

function AnimatedScore({
    value,
    active,
    songId,
    rollDuration = 600,
}: {
    value: number;
    active?: boolean;
    songId: string;
    rollDuration?: number;
}) {
    const [displayValue, setDisplayValue] = useState(value);
    const [previousValue, setPreviousValue] = useState(value);
    const [rolling, setRolling] = useState(false);
    const displayValueRef = useRef(value);

    useEffect(() => {
        const start = displayValueRef.current;
        const end = value;
        if (start === end) return;

        setPreviousValue(start);
        setRolling(true);
        const duration = rollDuration;
        const startedAt = performance.now();
        let frame = 0;
        const rollTimer = window.setTimeout(() => setRolling(false), duration + 40);

        function tick(now: number) {
            const progress = Math.min((now - startedAt) / duration, 1);
            const eased = smoothScoreProgress(progress);
            const nextValue = Math.round(start + (end - start) * eased);
            displayValueRef.current = nextValue;
            setDisplayValue(nextValue);
            if (progress < 1) frame = window.requestAnimationFrame(tick);
        }

        frame = window.requestAnimationFrame(tick);
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(rollTimer);
        };
    }, [rollDuration, value]);

    return (
        <strong
            className={[
                "nightScore",
                active ? "impact" : "",
                rolling ? "rolling" : "",
            ]
                .filter(Boolean)
                .join(" ")}
            data-score-target={songId}
            style={{ "--score-roll-duration": `${rollDuration}ms` } as CSSProperties}
        >
            <span className="scoreRoller" aria-hidden="true">
                <span>{previousValue}</span>
                <span>{displayValue}</span>
            </span>
            <span className="srOnly">{displayValue}</span>
        </strong>
    );
}

export function ResultNightScoreboard({
    songs,
    scores,
    awards,
    activeSongId,
    highlightedSongIds,
    settledHighlightSongIds,
    resettingSongIds,
    slowRollingSongId,
    slowRollingDurationMs = 1500,
    completedSongIds,
    winnerSongId,
    registerCard,
}: ResultNightScoreboardProps) {
    const { isMobile } = useResponsive();
    const awardBySongId = new Map(awards.map((award) => [award.songId, award]));

    function renderCard(song: FinalistResult, index: number) {
        const award = awardBySongId.get(song.id);
        return (
            <article
                key={song.id}
                ref={(node) => registerCard(song.id, node)}
                className={[
                    "nightScoreboardCard",
                    activeSongId === song.id && !highlightedSongIds.has(song.id)
                        ? "active"
                        : "",
                    highlightedSongIds.has(song.id) ? "awarded" : "",
                    settledHighlightSongIds.has(song.id) ? "settled" : "",
                    resettingSongIds.has(song.id) ? "resetting" : "",
                    index === 0 ? "podiumFirst" : "",
                    index === 1 ? "podiumSecond" : "",
                    index === 2 ? "podiumThird" : "",
                    completedSongIds.has(song.id) ? "completed" : "",
                    winnerSongId === song.id ? "winner" : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <span className="nightRank">{index + 1}</span>
                <FlagEmoji alt="" code={song.countryCode} src={song.flagEmoji} />
                <span className="nightCountry">
                    <strong>{song.country}</strong>
                    <small>{song.title}</small>
                </span>
                <span className="nightScoreWrap">
                    <AnimatedScore
                        value={scores[song.id] ?? 0}
                        active={Boolean(award)}
                        songId={song.id}
                        rollDuration={
                            slowRollingSongId === song.id
                                ? slowRollingDurationMs
                                : award
                                    ? 1500
                                    : 600
                        }
                    />
                    {award ? (
                        <em
                            className="nightAward"
                            style={
                                {
                                    "--award-delay": `${award.delay}ms`,
                                    "--award-flight-duration": `${award.flightDuration ?? 2600}ms`,
                                } as CSSProperties
                            }
                        >
                            +{award.points}
                        </em>
                    ) : null}
                    {completedSongIds.has(song.id) ? (
                        <span className="nightLock" aria-hidden="true">
                            <LockKeyholeOpen
                                className="nightLockOpen"
                                size={18}
                                strokeWidth={2.2}
                            />
                            <LockKeyhole
                                className="nightLockClosed"
                                size={18}
                                strokeWidth={2.2}
                            />
                            <span className="nightLockRays" />
                        </span>
                    ) : null}
                </span>
            </article>
        );
    }

    function scoreboardDesktop() {
        const splitIndex = Math.ceil(songs.length / 2);
        const [leftColumn, rightColumn] = [songs.slice(0, splitIndex), songs.slice(splitIndex)];
        return (
            <div className="nightScoreboard">
                <div>{leftColumn.map((song, index) => renderCard(song, index))}</div>
                <div>
                    {rightColumn.map((song, index) =>
                        renderCard(song, leftColumn.length + index),
                    )}
                </div>
            </div>
        );
    }

    function scoreboardMobile() {
        const splitIndex = Math.ceil(songs.length / 3);
        const [leftColumn, centerColumn, rightColumn] = [songs.slice(0, splitIndex), songs.slice(splitIndex, splitIndex * 2), songs.slice(splitIndex * 2)];
        return (
            <div className="nightScoreboard">
                <div>{leftColumn.map((song, index) => renderCard(song, index))}</div>
                <div>{centerColumn.map((song, index) => renderCard(song, leftColumn.length + index))}</div>
                <div>
                    {rightColumn.map((song, index) =>
                        renderCard(song, leftColumn.length + centerColumn.length + index),
                    )}
                </div>
            </div>
        );
    }

    return (
        isMobile ? scoreboardMobile() : scoreboardDesktop()
    );
}
