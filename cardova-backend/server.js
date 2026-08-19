import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { searchListings } from "./ebay.js";
import { pokemonCardsRouter } from "./src/routes/pokemonCards.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env"), quiet: true });
const catalog = JSON.parse(readFileSync(join(__dirname, "catalog.json"), "utf8"));

const SPORTS = new Set(["Football", "Baseball", "Basketball"]);

const app = express();
app.use(cors());
app.use("/api/pokemon", pokemonCardsRouter);

// Search and grade tabs use the sample catalog.
// Live eBay listings are fetched separately via GET /api/cards/:id/listings.

function gradePrice(card, gradeId) {
  const grade = (card.grades || []).find((item) => item.id === gradeId);
  return grade ? grade.price : null;
}

const NUMERIC_GRADES = [
  { id: "g95", label: "9.5", factor: 0.45 },
  { id: "g9", label: "9", factor: 0.28 },
  { id: "g8", label: "8", factor: 0.18 },
  { id: "g7", label: "7", factor: 0.12 },
  { id: "g6", label: "6", factor: 0.09 },
  { id: "g5", label: "5", factor: 0.07 },
  { id: "g4", label: "4", factor: 0.055 },
  { id: "g3", label: "3", factor: 0.045 },
  { id: "g2", label: "2", factor: 0.038 },
  { id: "g1", label: "1", factor: 0.032 },
];

function expandCard(card) {
  const raw = gradePrice(card, "raw") || 0;
  const psa10 = gradePrice(card, "psa10") || raw || 1;
  const bgs10 = gradePrice(card, "bgs10") || Math.round(psa10 * 1.8);
  const extraGrades = [
    { id: "cgc10", label: "CGC 10", price: Math.max(1, Math.round(psa10 * 0.92)) },
    { id: "tag10", label: "TAG 10", price: Math.max(1, Math.round(psa10 * 0.88)) },
    ...NUMERIC_GRADES.map(({ id, label, factor }) => ({
      id,
      label,
      price: Math.max(1, Math.round(psa10 * factor)),
    })),
  ];

  const grades = [
    card.grades?.find((grade) => grade.id === "raw") || { id: "raw", label: "Ungraded", price: raw },
    card.grades?.find((grade) => grade.id === "psa10") || { id: "psa10", label: "PSA 10", price: psa10 },
    card.grades?.find((grade) => grade.id === "bgs10") || { id: "bgs10", label: "BGS 10", price: bgs10 },
    ...extraGrades,
  ];

  const extraSales = extraGrades.map((grade, index) => {
    const month = String((index % 12) + 1).padStart(2, "0");
    return {
      date: `2026-${month}-12`,
      title: `${card.name} #${card.number} ${grade.label}`,
      price: Math.max(1, Math.round(grade.price * 0.95)),
      gradeId: grade.id,
      source: "eBay",
    };
  });

  const { marketplaces, ...rest } = card;

  return {
    ...rest,
    sample: true,
    grades,
    sales: [...(card.sales || []), ...extraSales],
  };
}

function toListItem(card) {
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    set: card.set,
    category: card.category,
    variant: card.variant,
    image: card.image,
    rawPrice: gradePrice(card, "raw"),
    psa10Price: gradePrice(card, "psa10"),
  };
}

function matchesQuery(card, query) {
  if (!query) return true;
  const haystack = [
    card.name,
    card.number,
    card.set,
    card.category,
    card.variant,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

app.get("/api/cards", (req, res) => {
  const query = (req.query.q || "").trim();
  const sort = req.query.sort || "name";
  const setFilter = (req.query.set || "").trim();
  const category = (req.query.category || "").trim();
  const includeVariants = req.query.variants !== "false";

  let results = catalog.filter((card) => matchesQuery(card, query));

  if (setFilter) {
    results = results.filter((card) => card.set === setFilter);
  }

  if (category === "Sports") {
    results = results.filter((card) => SPORTS.has(card.category));
  } else if (category) {
    results = results.filter((card) => card.category === category);
  }

  if (!includeVariants) {
    results = results.filter((card) => !card.variant);
  }

  results.sort((a, b) => {
    const priceA = gradePrice(a, "psa10") || 0;
    const priceB = gradePrice(b, "psa10") || 0;
    if (sort === "price-high") return priceB - priceA;
    if (sort === "price-low") return priceA - priceB;
    return a.name.localeCompare(b.name);
  });

  const sets = [...new Set(catalog.map((card) => card.set))].sort();

  res.json({
    query,
    sample: true,
    results: results.map(toListItem),
    sets,
  });
});

app.get("/api/cards/:id/listings", async (req, res) => {
  const card = catalog.find((item) => item.id === req.params.id);
  if (!card) {
    return res.status(404).json({ error: "We could not find that card." });
  }

  const query = [card.name, card.set, card.number].filter(Boolean).join(" ");
  const result = await searchListings(query);
  res.json(result);
});

app.get("/api/cards/:id", (req, res) => {
  const card = catalog.find((item) => item.id === req.params.id);
  if (!card) {
    return res.status(404).json({ error: "We could not find that card." });
  }
  res.json(expandCard(card));
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
