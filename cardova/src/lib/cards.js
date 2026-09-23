export function cardApiUrl(id, suffix = "") {
  return `/api/cards/${encodeURIComponent(id)}${suffix}`;
}

export function samplePriceKey(price) {
  return `${price?.gradingCompany ?? ""}|${price?.grade ?? ""}|${price?.label ?? ""}`;
}

export function sameGrade(left, right) {
  return (left?.gradingCompany ?? null) === (right?.gradingCompany ?? null) && (left?.grade ?? null) === (right?.grade ?? null);
}

export function findSamplePrice(prices, gradingCompany, grade) {
  return (prices || []).find(
    (price) =>
      price.dataType === "sample" &&
      (price.gradingCompany ?? null) === gradingCompany &&
      (price.grade ?? null) === grade
  );
}

export function cardNumberOf(card) {
  return card?.cardNumber || card?.number || "";
}

export function cardSetOf(card) {
  return card?.setName || card?.set || "";
}
