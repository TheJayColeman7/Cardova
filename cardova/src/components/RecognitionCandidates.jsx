function scoreLabel(candidate) {
  if (typeof candidate.providerScore !== "number") return null;
  return `Score ${candidate.providerScore.toFixed(2)}`;
}

function CandidateBody({ candidate }) {
  const score = scoreLabel(candidate);
  const extra = [candidate.finish, candidate.variant, candidate.language].filter(Boolean).join(" · ");

  return (
    <div className="flex gap-3 min-w-0">
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-charcoal-50">
        {candidate.imageUrl ? (
          <img src={candidate.imageUrl} alt="" className="h-full w-full object-contain" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="font-bold text-navy text-lg leading-tight">{candidate.name || "Unknown card"}</p>
        <p className="text-sm text-charcoal mt-1">
          {[candidate.setName, candidate.cardNumber ? `#${candidate.cardNumber}` : null].filter(Boolean).join(" · ")}
        </p>
        {extra && <p className="text-sm text-charcoal-400 mt-1">{extra}</p>}
        {score && <p className="text-sm font-semibold text-navy mt-1">{score}</p>}
      </div>
    </div>
  );
}

export default function RecognitionCandidates({ candidates, onConfirm, onNone }) {
  const [best, ...rest] = candidates;

  if (!best) return null;

  const resolved = best.resolutionStatus === "resolved" && best.canonicalCardId;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xl font-bold text-navy">We think this is...</p>
        <div className="mt-3 rounded-2xl border-2 border-navy p-3">
          <CandidateBody candidate={best} />
          <button
            type="button"
            onClick={() => onConfirm(best)}
            className="mt-4 w-full min-h-14 rounded-2xl bg-black text-white font-bold text-lg"
          >
            {resolved ? "This Is My Card" : "Search Sweet Home Cards"}
          </button>
          {!resolved && (
            <p className="mt-2 text-sm text-charcoal-400">
              This suggestion is not tied to one card in Sweet Home Cards yet.
            </p>
          )}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="flex flex-col gap-3">
          {rest.map((candidate) => (
            <button
              key={`${candidate.provider}:${candidate.providerCardId}`}
              type="button"
              onClick={() => onConfirm(candidate)}
              className="rounded-2xl border border-charcoal-200 p-3 text-left"
            >
              <CandidateBody candidate={candidate} />
              <p className="mt-2 font-bold text-navy">
                {candidate.resolutionStatus === "resolved" && candidate.canonicalCardId
                  ? "This Is My Card"
                  : "Search Sweet Home Cards"}
              </p>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={onNone} className="min-h-12 font-semibold text-navy">
        None of These
      </button>
    </div>
  );
}
