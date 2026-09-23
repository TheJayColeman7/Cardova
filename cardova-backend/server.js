import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { searchListings } from "./ebay.js";
import { pokemonCardsRouter } from "./src/routes/pokemonCards.ts";
import { activeListingsResponse } from "./src/domain/market.ts";
import { getPokemonCardById, listPokemonCards } from "./src/repositories/pokemonCardRepository.ts";
import {
  CardCatalogUnavailableError,
  buildActiveListingQuery,
  createCardService,
} from "./src/services/cardService.ts";
import { isDatabaseUnavailable } from "./src/utils/databaseUnavailable.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env"), quiet: true });
const catalog = JSON.parse(readFileSync(join(__dirname, "catalog.json"), "utf8"));

const cardService = createCardService({
  catalog,
  pokemon: {
    async searchByName(name) {
      const result = await listPokemonCards({ name, page: 1, pageSize: 25 });
      return result.results;
    },
    async getById(id) {
      try {
        return await getPokemonCardById(id);
      } catch (error) {
        if (isDatabaseUnavailable(error)) throw new CardCatalogUnavailableError();
        throw error;
      }
    },
  },
});

const app = express();
app.use(cors());
app.use("/api/pokemon", pokemonCardsRouter);

function sendCardError(res, error) {
  if (error instanceof CardCatalogUnavailableError || error?.name === "ConfigError") {
    res.status(503).json({ error: "Card catalog is not available." });
    return;
  }

  console.error("Card API error:", error instanceof Error ? error.message : error);
  res.status(500).json({ error: "Failed to load cards." });
}

app.get("/api/cards", async (req, res) => {
  try {
    const result = await cardService.searchCards({
      q: req.query.q,
      sort: req.query.sort,
      set: req.query.set,
      category: req.query.category,
      includeVariants: req.query.variants !== "false",
    });
    res.json(result);
  } catch (error) {
    sendCardError(res, error);
  }
});

app.get("/api/cards/:id/listings", async (req, res) => {
  try {
    const card = await cardService.getCard(req.params.id);
    if (!card) {
      res.status(404).json({ error: "We could not find that card." });
      return;
    }

    const result = await searchListings(buildActiveListingQuery(card));
    res.json(activeListingsResponse(result));
  } catch (error) {
    sendCardError(res, error);
  }
});

app.get("/api/cards/:id", async (req, res) => {
  try {
    const detail = await cardService.getCardDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "We could not find that card." });
      return;
    }
    res.json(detail);
  } catch (error) {
    sendCardError(res, error);
  }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
