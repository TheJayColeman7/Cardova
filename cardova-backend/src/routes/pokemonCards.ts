import { Router } from "express";
import { ConfigError } from "../config/env.js";
import { getPokemonCardById, listPokemonCards } from "../repositories/pokemonCardRepository.js";

export const pokemonCardsRouter = Router();

function queryString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function queryPositiveInt(value: unknown): number | undefined {
  const raw = queryString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function sendError(error: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  if (error instanceof ConfigError) {
    res.status(503).json({ error: "PostgreSQL is not configured." });
    return;
  }

  console.error("Pokémon cards API error:", error instanceof Error ? error.message : error);
  res.status(500).json({ error: "Failed to load Pokémon cards." });
}

pokemonCardsRouter.get("/cards", async (req, res) => {
  try {
    const page = queryPositiveInt(req.query.page) ?? 1;
    const requestedPageSize = queryPositiveInt(req.query.pageSize) ?? 25;
    const pageSize = Math.min(requestedPageSize, 100);
    const pokedexNumber = queryPositiveInt(req.query.pokedexNumber);

    const result = await listPokemonCards({
      name: queryString(req.query.name),
      pokedexNumber,
      set: queryString(req.query.set),
      rarity: queryString(req.query.rarity),
      page,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    sendError(error, res);
  }
});

pokemonCardsRouter.get("/cards/:id", async (req, res) => {
  try {
    const id = queryString(req.params.id);
    if (!id) {
      res.status(400).json({ error: "A card id is required." });
      return;
    }

    const card = await getPokemonCardById(id);
    if (!card) {
      res.status(404).json({ error: "We could not find that Pokémon card." });
      return;
    }

    res.json(card);
  } catch (error) {
    sendError(error, res);
  }
});
