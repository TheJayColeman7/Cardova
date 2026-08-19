CREATE TABLE pokemon_cards (
    id BIGSERIAL PRIMARY KEY,

    api_id VARCHAR(100) UNIQUE NOT NULL,

    pokemon_name VARCHAR(255),
    pokedex_number INTEGER,

    card_name VARCHAR(255) NOT NULL,
    card_number VARCHAR(50),

    set_id VARCHAR(100),
    set_name VARCHAR(255),
    series_name VARCHAR(255),

    rarity VARCHAR(150),
    artist VARCHAR(255),

    supertype VARCHAR(100),
    subtypes TEXT[],
    pokemon_types TEXT[],

    hp INTEGER,

    image_small_url TEXT,
    image_large_url TEXT,

    release_date DATE,

    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pokemon_cards_pokemon_name ON pokemon_cards (pokemon_name);
CREATE INDEX idx_pokemon_cards_pokedex_number ON pokemon_cards (pokedex_number);
CREATE INDEX idx_pokemon_cards_set_id ON pokemon_cards (set_id);
CREATE INDEX idx_pokemon_cards_rarity ON pokemon_cards (rarity);
CREATE INDEX idx_pokemon_cards_card_number ON pokemon_cards (card_number);
