import { useEffect, useState } from "react";
import { cardApiUrl } from "../lib/cards.js";
import { formatDate, formatListingPrice } from "../lib/format.js";

const UNSPECIFIED_VARIANT = "__unspecified__";
const RAW_CONDITIONS = ["NM", "LP", "MP", "HP", "DMG", "Unknown"];

function money(value, currency = "USD") {
  return formatListingPrice(value, currency);
}

function variantLabel(value) {
  if (value === UNSPECIFIED_VARIANT) return "Unspecified variant";
  return value;
}

function confidenceLabel(confidence) {
  if (confidence === "very_low") return "Evidence: Very low";
  if (confidence === "low") return "Evidence: Low";
  if (confidence === "moderate") return "Evidence: Moderate";
  if (confidence === "strong") return "Evidence: Strong";
  return null;
}

function bucketLines(bucket) {
  if (!bucket || (bucket.evidence === "none" && !(bucket.allObserved?.saleCount > 0))) {
    return { price: "—", note: "No recent sold comps" };
  }
  if (bucket.saleCount === 0 && bucket.allObserved?.saleCount > 0) {
    return {
      price: "—",
      note: "No comps were clean enough to price",
      confidence: confidenceLabel(bucket.confidence),
    };
  }
  if (bucket.evidence === "single") {
    return {
      price: money(bucket.latestSale?.soldPrice),
      note: "Last sale",
      sales: bucket.saleCount,
      confidence: confidenceLabel(bucket.confidence),
      warned: bucket.quality?.warned > 0,
    };
  }
  const range =
    bucket.minimum != null && bucket.maximum != null
      ? `Recent range ${money(bucket.minimum)}–${money(bucket.maximum)}`
      : null;
  return {
    price: money(bucket.median),
    note: bucket.evidence === "limited" ? "Limited data" : "Median",
    range,
    sales: bucket.saleCount,
    last: bucket.latestSale,
    confidence: confidenceLabel(bucket.confidence),
    warned: bucket.quality?.warned > 0,
  };
}

function GradeChip({ label, bucket }) {
  const lines = bucketLines(bucket);
  return (
    <div className="min-w-[140px] shrink-0 rounded-2xl border border-charcoal-200 bg-white px-3 py-3">
      <p className="text-sm font-semibold text-charcoal">{label}</p>
      <p className="text-xl font-extrabold text-navy">{lines.price}</p>
      <p className="text-xs font-semibold text-charcoal-400">{lines.note}</p>
      {lines.confidence && <p className="text-xs font-semibold text-navy">{lines.confidence}</p>}
      {lines.warned && <p className="text-xs text-charcoal">Includes flagged sales</p>}
      {lines.range && <p className="mt-1 text-xs text-charcoal">{lines.range}</p>}
      {lines.sales > 0 && <p className="text-xs text-charcoal">Sales: {lines.sales}</p>}
      {lines.last && lines.sales > 1 && (
        <p className="text-xs text-charcoal">
          Last sale: {money(lines.last.soldPrice)}
          {lines.last.soldAt ? ` on ${formatDate(lines.last.soldAt)}` : ""}
        </p>
      )}
    </div>
  );
}

function gradeLabel(company, grade) {
  if (grade === "unknown") return company;
  return `${company} ${grade}`;
}

function rawChips(summaries) {
  const rows = RAW_CONDITIONS.map((key) => ({
    key,
    label: `Raw · ${key}`,
    bucket: summaries.rawConditions?.[key],
  })).filter((item) => item.bucket && (item.bucket.saleCount > 0 || item.bucket.allObserved?.saleCount > 0));
  if (rows.length > 0) return rows;
  return [{ key: "Raw", label: "Raw", bucket: summaries.raw }];
}

function reviewedComps(soldComps) {
  return (soldComps ?? []).filter((comp) => comp.quality?.flags?.length && comp.quality.disposition !== "included");
}

export default function SoldMarket({ cardId }) {
  const [market, setMarket] = useState(null);
  const [variant, setVariant] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError("");
      const suffix = variant ? `/market?variant=${encodeURIComponent(variant)}` : "/market";
      try {
        const res = await fetch(cardApiUrl(cardId, suffix));
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || "Sold prices are unavailable right now.");
        if (!cancelled) setMarket(json);
      } catch (err) {
        if (!cancelled) {
          setMarket(null);
          setError(err.message || "Sold prices are unavailable right now.");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [cardId, variant]);

  if (error) {
    return <p className="mt-6 text-sm font-semibold text-navy">{error}</p>;
  }
  if (!market) {
    return <p className="mt-6 text-sm text-charcoal">Looking up sold prices…</p>;
  }
  if (!market.available) {
    return <p className="mt-6 text-sm text-charcoal-400">Recent sold comps are not available for this card yet.</p>;
  }

  const summaries = market.summaries;
  const otherGrades = summaries
    ? Object.entries(summaries.grades).flatMap(([company, grades]) =>
        Object.entries(grades)
          .filter(([grade, bucket]) => !(company === "PSA" && ["8", "9", "10"].includes(grade)) && bucket.saleCount > 0)
          .map(([grade, bucket]) => ({ company, grade, bucket }))
      )
    : [];
  const qualityRows = reviewedComps(market.soldComps);

  return (
    <section className="mt-8">
      <h2 className="text-xl font-extrabold text-navy">Recent sold market</h2>
      <p className="mt-1 text-sm text-charcoal-400">
        Sold prices from the last {market.windowDays} days. These are not cards for sale now.
      </p>
      {!market.windowComplete && (
        <p className="mt-1 text-sm text-charcoal">This window is capped. It is not every sale on record.</p>
      )}
      {market.variants.length > 1 && (
        <label className="mt-4 block text-sm font-semibold text-navy">
          Select variant
          <select
            className="mt-1 block w-full min-h-12 rounded-2xl border border-charcoal-200 px-3"
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
          >
            <option value="">Select variant</option>
            {market.variants.map((item) => (
              <option key={item} value={item}>
                {variantLabel(item)}
              </option>
            ))}
          </select>
        </label>
      )}
      {market.selectionRequired && (
        <p className="mt-3 text-sm font-semibold text-navy">Choose a variant before sold prices are combined.</p>
      )}
      {summaries && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {rawChips(summaries).map((item) => (
            <GradeChip key={item.key} label={item.label} bucket={item.bucket} />
          ))}
          <GradeChip label="PSA 8" bucket={summaries.grades.PSA?.["8"]} />
          <GradeChip label="PSA 9" bucket={summaries.grades.PSA?.["9"]} />
          <GradeChip label="PSA 10" bucket={summaries.grades.PSA?.["10"]} />
        </div>
      )}
      {summaries?.rawSelectionRequired && (
        <p className="mt-2 text-xs text-charcoal">
          Raw conditions are shown separately. They are not combined into one raw price.
        </p>
      )}
      {summaries && !summaries.rawSelectionRequired && rawChips(summaries).length > 1 && summaries.raw?.condition && (
        <p className="mt-2 text-xs text-charcoal">
          Primary raw condition is {summaries.raw.condition}. Other conditions are not included in that figure.
        </p>
      )}
      {otherGrades.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-navy">Other grades</summary>
          <div className="mt-3 flex gap-3 overflow-x-auto">
            {otherGrades.map((item) => (
              <GradeChip key={`${item.company}-${item.grade}`} label={gradeLabel(item.company, item.grade)} bucket={item.bucket} />
            ))}
          </div>
        </details>
      )}
      {!market.selectionRequired && market.quality && (
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-navy">Comp quality</summary>
          <p className="mt-2 text-sm text-charcoal">
            {market.quality.included} included · {market.quality.warned} flagged · {market.quality.excluded} excluded
          </p>
          <p className="mt-1 text-xs text-charcoal-400">
            Evidence describes how much clean sold data we have. It is not a prediction of the next sale.
          </p>
          {market.quality.exclusionReasons?.length > 0 && (
            <ul className="mt-2 text-sm text-charcoal">
              {market.quality.exclusionReasons.map((item) => (
                <li key={item.code}>
                  {item.count} excluded · {item.reason}
                </li>
              ))}
            </ul>
          )}
          {qualityRows.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm text-baby-blue-600">
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Title</th>
                    <th className="py-2 pr-3 font-semibold text-right">Sold</th>
                    <th className="py-2 font-semibold">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityRows.map((comp) => (
                    <tr key={comp.externalId || comp.url || comp.title} className="border-t border-charcoal-100">
                      <td className="py-3 pr-3 whitespace-nowrap capitalize">{comp.quality.disposition}</td>
                      <td className="py-3 pr-3">{comp.title || "Sold listing"}</td>
                      <td className="py-3 pr-3 text-right font-bold text-navy whitespace-nowrap">
                        {money(comp.soldPrice, comp.currency || "USD")}
                      </td>
                      <td className="py-3 text-sm text-charcoal">
                        {comp.quality.flags.map((item) => item.reason).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}

      <h3 className="mt-8 text-lg font-extrabold text-navy">Recent sold comps</h3>
      {market.soldComps.length === 0 ? (
        <p className="mt-2 text-sm text-charcoal">No recent sold comps.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm text-baby-blue-600">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Title</th>
                <th className="py-2 pr-3 font-semibold">Grade</th>
                <th className="py-2 pr-3 font-semibold text-right">Sold</th>
                <th className="py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {market.soldComps.map((comp) => (
                <tr key={comp.externalId || comp.url || comp.title} className="border-t border-charcoal-100">
                  <td className="py-3 pr-3 whitespace-nowrap">{formatDate(comp.soldAt)}</td>
                  <td className="py-3 pr-3">{comp.title || "Sold listing"}</td>
                  <td className="py-3 pr-3 whitespace-nowrap">
                    {comp.gradingCompany && comp.grade ? `${comp.gradingCompany} ${comp.grade}` : comp.condition || "Raw"}
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-navy whitespace-nowrap">
                    {money(comp.soldPrice, comp.currency || "USD")}
                  </td>
                  <td className="py-3">
                    {comp.url ? (
                      <a href={comp.url} target="_blank" rel="noreferrer" className="font-bold text-baby-blue-600">
                        {comp.marketplace || "Listing"}
                      </a>
                    ) : (
                      comp.marketplace || "Listing"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
