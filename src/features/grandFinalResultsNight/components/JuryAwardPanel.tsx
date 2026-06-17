import { CSSProperties } from "react";
import { useResponsive } from "../../../hooks/useDisplayType.tsx";
import { JuryVote, ResultDelegation } from "../../../types";
import "../styles/JuryAwardPanel.css";

const JURY_AWARD_STAGGER_MS = 100;

function juryVotesForDisplay(delegation?: ResultDelegation, hideTwelve = false) {
    return [...(delegation?.result.jury?.votesAwarded ?? [])]
        .filter((vote) => vote.points > 0 && (!hideTwelve || vote.points !== 12))
        .sort((a, b) => b.points - a.points);
}

function mobileJuryVotesForDisplay(votes: JuryVote[] = [], exiting = false, delegation: ResultDelegation) {
    const left = votes.slice(0, Math.ceil(votes.length / 3));
    const center = votes.slice(Math.ceil(votes.length / 3), Math.ceil(votes.length / 3) * 2);
    const right = votes.slice(Math.ceil(votes.length / 3) * 2);

    return (
        <section className={exiting ? "juryAwardPanel exiting" : "juryAwardPanel"}>
            <h3>{delegation.country} has awarded:</h3>
            <div>
                <div>
                    {left.map((vote, index) => (
                        <span
                            key={`${vote.country}-${vote.points}`}
                            style={
                                {
                                    "--vote-delay": `${index * JURY_AWARD_STAGGER_MS}ms`,
                                    "--vote-exit-delay": `${index * 35}ms`,
                                } as CSSProperties
                            }
                        >
                            <strong>{vote.points}</strong> {vote.country}
                        </span>
                    ))}
                </div>
                <div>
                    {center.map((vote, index) => (
                        <span
                            key={`${vote.country}-${vote.points}`}
                            style={
                                {
                                    "--vote-delay": `${(left.length + index) * JURY_AWARD_STAGGER_MS}ms`,
                                    "--vote-exit-delay": `${(left.length + index) * 35}ms`,
                                } as CSSProperties
                            }
                        >
                            <strong>{vote.points}</strong> {vote.country}
                        </span>
                    ))}
                </div>
                <div>
                    {right.map((vote, index) => (
                        <span
                            key={`${vote.country}-${vote.points}`}
                            style={
                                {
                                    "--vote-delay": `${(left.length + center.length + index) * JURY_AWARD_STAGGER_MS}ms`,
                                    "--vote-exit-delay": `${(left.length + center.length + index) * 35}ms`,
                                } as CSSProperties
                            }
                        >
                            <strong>{vote.points}</strong> {vote.country}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

function webJuryVotesForDisplay(votes: JuryVote[] = [], exiting = false, delegation: ResultDelegation) {
    const left = votes.slice(0, Math.ceil(votes.length / 2));
    const right = votes.slice(Math.ceil(votes.length / 2));

    return (
        <section className={exiting ? "juryAwardPanel exiting" : "juryAwardPanel"}>
            <h3>{delegation.country} has awarded:</h3>
            <div>
                <div>
                    {left.map((vote, index) => (
                        <span
                            key={`${vote.country}-${vote.points}`}
                            style={
                                {
                                    "--vote-delay": `${index * JURY_AWARD_STAGGER_MS}ms`,
                                    "--vote-exit-delay": `${index * 35}ms`,
                                } as CSSProperties
                            }
                        >
                            <strong>{vote.points}</strong> {vote.country}
                        </span>
                    ))}
                </div>
                <div>
                    {right.map((vote, index) => (
                        <span
                            key={`${vote.country}-${vote.points}`}
                            style={
                                {
                                    "--vote-delay": `${(left.length + index) * JURY_AWARD_STAGGER_MS}ms`,
                                    "--vote-exit-delay": `${(left.length + index) * 35}ms`,
                                } as CSSProperties
                            }
                        >
                            <strong>{vote.points}</strong> {vote.country}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function JuryAwardPanel({
    delegation,
    hideTwelve,
    visibleVotes,
    exiting = false,
}: {
    delegation?: ResultDelegation;
    hideTwelve?: boolean;
    visibleVotes?: JuryVote[];
    exiting?: boolean;
}) {
    const { isMobile } = useResponsive();
    const votes = [...(visibleVotes ?? juryVotesForDisplay(delegation, hideTwelve))]
        .sort((a, b) => b.points - a.points);
    if (!delegation) return null;

    return isMobile ? mobileJuryVotesForDisplay(votes, exiting, delegation) : webJuryVotesForDisplay(votes, exiting, delegation);

}