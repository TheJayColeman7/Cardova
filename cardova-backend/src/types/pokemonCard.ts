export interface PokemonTcgSet {
  id?: string;
  name?: string;
  series?: string;
  releaseDate?: string;
}

export interface PokemonTcgImages {
  small?: string;
  large?: string;
}

export interface PokemonTcgCard {
  id: string;
  name?: string;
  nationalPokedexNumbers?: number[];
  number?: string;
  set?: PokemonTcgSet;
  rarity?: string;
  artist?: string;
  supertype?: string;
  subtypes?: string[];
  types?: string[];
  hp?: string;
  images?: PokemonTcgImages;
  [key: string]: unknown;
}

export interface PokemonTcgCardsPage {
  data: PokemonTcgCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface PokemonCardRecord {
  apiId: string;
  pokemonName: string | null;
  pokedexNumber: number | null;
  cardName: string;
  cardNumber: string | null;
  setId: string | null;
  setName: string | null;
  seriesName: string | null;
  rarity: string | null;
  artist: string | null;
  supertype: string | null;
  subtypes: string[];
  pokemonTypes: string[];
  hp: number | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  releaseDate: string | null;
  rawData: PokemonTcgCard;
}

export interface PokemonCardRow {
  id: number;
  api_id: string;
  pokemon_name: string | null;
  pokedex_number: number | null;
  card_name: string;
  card_number: string | null;
  set_id: string | null;
  set_name: string | null;
  series_name: string | null;
  rarity: string | null;
  artist: string | null;
  supertype: string | null;
  subtypes: string[] | null;
  pokemon_types: string[] | null;
  hp: number | null;
  image_small_url: string | null;
  image_large_url: string | null;
  release_date: string | null;
  raw_data: PokemonTcgCard;
  created_at: Date;
  updated_at: Date;
}

export interface PokemonCardListItem {
  id: number;
  apiId: string;
  pokemonName: string | null;
  pokedexNumber: number | null;
  cardName: string;
  cardNumber: string | null;
  setId: string | null;
  setName: string | null;
  seriesName: string | null;
  rarity: string | null;
  artist: string | null;
  supertype: string | null;
  subtypes: string[];
  pokemonTypes: string[];
  hp: number | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  releaseDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PokemonCardDetail extends PokemonCardListItem {
  rawData: PokemonTcgCard;
}

export interface PokemonCardListQuery {
  name?: string;
  pokedexNumber?: number;
  set?: string;
  rarity?: string;
  page: number;
  pageSize: number;
}

export interface PokemonCardListResult {
  page: number;
  pageSize: number;
  total: number;
  results: PokemonCardListItem[];
}
