const STORAGE_KEY = "shc-my-cards";

function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function sameCard(saved, card) {
  return saved.id === card.id || saved.id === card.sourceId;
}

export function toSavedCard(card) {
  return {
    id: card.id,
    sourceId: card.sourceId,
    name: card.name,
    cardNumber: card.cardNumber ?? card.number ?? null,
    setName: card.setName ?? card.set ?? null,
    variation: card.variation ?? card.variant ?? null,
    finish: card.finish ?? null,
    rookie: card.rookie ?? null,
    sport: card.sport ?? null,
    game: card.game ?? card.category ?? null,
    imageSmallUrl: card.imageSmallUrl ?? card.image ?? null,
  };
}

export function getSavedCards() {
  return readList();
}

export function isCardSaved(card) {
  return readList().some((saved) => sameCard(saved, card));
}

export function toggleSavedCard(card) {
  const list = readList();
  const exists = list.some((saved) => sameCard(saved, card));
  const next = exists ? list.filter((saved) => !sameCard(saved, card)) : [...list, toSavedCard(card)];
  writeList(next);
  return !exists;
}

export function savedCount() {
  return readList().length;
}
