export type CountryConfig = {
  country: string;
  countryCode: string;
  slug: string;
  aliases?: string[];
  emojiAssetName?: string;
  flagAssetName?: string;
  historicalAssets?: {
    fromYear: number;
    toYear: number;
    emojiAssetName?: string;
    flagAssetName?: string;
  }[];
  historicalNames?: {
    fromYear: number;
    toYear: number;
    country: string;
  }[];
};

export const countryConfigs = [
  { country: "Albania", countryCode: "AL", slug: "albania" },
  { country: "Andorra", countryCode: "AD", slug: "andorra" },
  { country: "Armenia", countryCode: "AM", slug: "armenia" },
  { country: "Australia", countryCode: "AU", slug: "australia" },
  { country: "Austria", countryCode: "AT", slug: "austria" },
  { country: "Azerbaijan", countryCode: "AZ", slug: "azerbaijan" },
  { country: "Belarus", countryCode: "BY", slug: "belarus" },
  { country: "Belgium", countryCode: "BE", slug: "belgium" },
  {
    country: "Bosnia & Herzegovina",
    countryCode: "BA",
    slug: "bosnia-and-herzegovina",
    aliases: ["Bosnia and Herzegovina"],
    historicalAssets: [
      {
        fromYear: 1993,
        toYear: 1997,
        emojiAssetName: "old-bosnia-and-herzegovina-flag-emoji.png",
        flagAssetName: "old-bosnia-and-herzegovina.png",
      },
    ],
  },
  { country: "Bulgaria", countryCode: "BG", slug: "bulgaria" },
  { country: "Croatia", countryCode: "HR", slug: "croatia" },
  { country: "Cyprus", countryCode: "CY", slug: "cyprus" },
  { country: "Czechia", countryCode: "CZ", slug: "czechia" },
  { country: "Czech Republic", countryCode: "CZ", slug: "czechia" },
  { country: "Denmark", countryCode: "DK", slug: "denmark" },
  { country: "Estonia", countryCode: "EE", slug: "estonia" },
  { country: "Finland", countryCode: "FI", slug: "finland" },
  { country: "France", countryCode: "FR", slug: "france" },
  { country: "Georgia", countryCode: "GE", slug: "georgia" },
  { country: "Germany", countryCode: "DE", slug: "germany" },
  { country: "Greece", countryCode: "GR", slug: "greece" },
  { country: "Hungary", countryCode: "HU", slug: "hungary" },
  { country: "Iceland", countryCode: "IS", slug: "iceland" },
  { country: "Ireland", countryCode: "IE", slug: "ireland" },
  { country: "Israel", countryCode: "IL", slug: "israel" },
  { country: "Italy", countryCode: "IT", slug: "italy" },
  { country: "Latvia", countryCode: "LV", slug: "latvia" },
  { country: "Lithuania", countryCode: "LT", slug: "lithuania" },
  { country: "Luxembourg", countryCode: "LU", slug: "luxembourg" },
  { country: "Malta", countryCode: "MT", slug: "malta" },
  { country: "Moldova", countryCode: "MD", slug: "moldova" },
  { country: "Monaco", countryCode: "MC", slug: "monaco" },
  { country: "Montenegro", countryCode: "ME", slug: "montenegro" },
  { country: "Morocco", countryCode: "MA", slug: "morocco" },
  { country: "Netherlands", countryCode: "NL", slug: "netherlands" },
  {
    country: "North Macedonia",
    countryCode: "MK",
    slug: "north-macedonia",
    aliases: ["F.Y.R. Macedonia", "FYR-Macedonia", "Macedonia"],
    historicalNames: [{ fromYear: 1993, toYear: 2018, country: "F.Y.R. Macedonia" }],
    historicalAssets: [
      {
        fromYear: 1993,
        toYear: 1995,
        emojiAssetName: "fyr-macedonia.png",
        flagAssetName: "fyr-macedonia.png",
      },
    ],
  },
  { country: "Norway", countryCode: "NO", slug: "norway" },
  { country: "Poland", countryCode: "PL", slug: "poland" },
  { country: "Portugal", countryCode: "PT", slug: "portugal" },
  { country: "Romania", countryCode: "RO", slug: "romania" },
  { country: "Russia", countryCode: "RU", slug: "russia" },
  { country: "San Marino", countryCode: "SM", slug: "san-marino" },
  { country: "Serbia", countryCode: "RS", slug: "serbia" },
  {
    country: "Serbia & Montenegro",
    countryCode: "CS",
    slug: "serbia-and-montenegro",
    flagAssetName: "serbia-and-montenegro.png",
    aliases: ["Serbia and Montenegro"],
  },
  { country: "Slovakia", countryCode: "SK", slug: "slovakia" },
  { country: "Slovenia", countryCode: "SI", slug: "slovenia" },
  { country: "Spain", countryCode: "ES", slug: "spain" },
  { country: "Sweden", countryCode: "SE", slug: "sweden" },
  { country: "Switzerland", countryCode: "CH", slug: "switzerland" },
  { country: "Turkey", countryCode: "TR", slug: "turkey", flagAssetName: "turkey.png" },
  { country: "Ukraine", countryCode: "UA", slug: "ukraine" },
  { country: "United Kingdom", countryCode: "GB", slug: "united-kingdom" },
  {
    country: "Yugoslavia",
    countryCode: "YU",
    slug: "yugoslavia",
    flagAssetName: "yugoslavia.png",
  },
] satisfies CountryConfig[];

export function countrySlug(country: string) {
  return country
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function countryEmojiUrl(country: CountryConfig) {
  return `/assets/emojis/${country.emojiAssetName ?? `${country.slug}-flag-emoji.png`}`;
}

export function countryFlagImageUrl(country: CountryConfig) {
  return `/assets/flags/${country.flagAssetName ?? `${country.slug}.png.webp`}`;
}

function historicalAssetsForYear(country: CountryConfig, year: number) {
  return country.historicalAssets?.find(
    (assets) => year >= assets.fromYear && year <= assets.toYear,
  );
}

export function countryDisplayNameForYear(country: CountryConfig, year: number) {
  return (
    country.historicalNames?.find((name) => year >= name.fromYear && year <= name.toYear)?.country ??
    country.country
  );
}

export function countryEmojiUrlForYear(country: CountryConfig, year: number) {
  const assets = historicalAssetsForYear(country, year);
  return `/assets/emojis/${
    assets?.emojiAssetName ?? country.emojiAssetName ?? `${country.slug}-flag-emoji.png`
  }`;
}

export function countryFlagImageUrlForYear(country: CountryConfig, year: number) {
  const assets = historicalAssetsForYear(country, year);
  return `/assets/flags/${assets?.flagAssetName ?? country.flagAssetName ?? `${country.slug}.png.webp`}`;
}

export const countriesByName = new Map(
  countryConfigs.flatMap((country) => [
    [country.country, country] as const,
    ...(country.aliases?.map((alias) => [alias, country] as const) ?? []),
  ]),
);
export const countriesByCode = new Map(countryConfigs.map((country) => [country.countryCode, country]));
export const countriesBySlug = new Map(countryConfigs.map((country) => [country.slug, country]));

export function getCountryConfig(country: string, countryCode?: string) {
  return countriesByName.get(country) ?? (countryCode ? countriesByCode.get(countryCode) : undefined);
}
