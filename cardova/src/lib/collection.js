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

export function getSavedCards() {
  return readList();
}

export function isCardSaved(id) {
  return readList().some((card) => card.id === id);
}

export function toggleSavedCard(card) {
  const list = readList();
  const exists = list.some((item) => item.id === card.id);
  const next = exists
    ? list.filter((item) => item.id !== card.id)
    : [
        ...list,
        {
          id: card.id,
          name: card.name,
          number: card.number,
          set: card.set,
          variant: card.variant,
          category: card.category,
          image: card.image,
        },
      ];
  writeList(next);
  return !exists;
}

export function savedCount() {
  return readList().length;
}
