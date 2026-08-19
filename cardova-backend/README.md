# Cardova Backend

Express API for Cardova. The sports-card catalog and eBay listings remain on the existing JavaScript routes. Pokémon card data is imported from the [Pokémon TCG API](https://docs.pokemontcg.io/) into local PostgreSQL.

Requires Node.js 18.18 or newer (native `fetch`).

## Setup

```bash
cd cardova-backend
npm install
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`. Fill in database credentials and, optionally, `POKEMON_TCG_API_KEY`. Never commit `.env`.

Create the PostgreSQL database if it does not exist:

```sql
CREATE DATABASE pokemon;
```

## Pokémon card import

```bash
npm run db:migrate
npm run import:cards
```

`db:migrate` is idempotent. `import:cards` upserts on `api_id`, so re-running updates existing rows instead of creating duplicates.

A free API key from the [Pokémon TCG Developer Portal](https://dev.pokemontcg.io) is strongly recommended. Unauthenticated requests are limited to about 30 per minute and 1,000 per day. A full catalog import is roughly 80 pages of 250 cards.

On Windows PostgreSQL installs, `DATABASE_PASSWORD` is usually required. An empty password is ignored by the `pg` client and will fail SCRAM authentication.

Card **image files are not stored**. Only the small and large image URLs from the API are saved, plus the complete API payload in `raw_data` (JSONB) for later fields.

## HTTP API

```bash
npm start
```

Server: `http://localhost:3001`

Sports catalog (unchanged, still served from `catalog.json`):

- `GET /api/cards`
- `GET /api/cards/:id`
- `GET /api/cards/:id/listings`

Pokémon cards (PostgreSQL):

- `GET /api/pokemon/cards`
- `GET /api/pokemon/cards/:id`

List query parameters:

| Parameter       | Description                                      |
|-----------------|--------------------------------------------------|
| `name`          | Case-insensitive match on card or Pokémon name   |
| `pokedexNumber` | Exact National Pokédex number                    |
| `set`           | Exact set id or set name contains                |
| `rarity`        | Case-insensitive exact rarity                    |
| `page`          | Default `1`                                      |
| `pageSize`      | Default `25`, max `100`                          |

`:id` may be the TCG API id (`sv1-1`) or the internal numeric id. Detail responses include normalized columns and `rawData`.

Examples:

```bash
curl "http://localhost:3001/api/pokemon/cards?name=charizard&pageSize=5"
curl "http://localhost:3001/api/pokemon/cards/base1-4"
curl "http://localhost:3001/api/cards"
```
