export type CountryConfig = {
  country: string;
  countryCode: string;
  flagEmoji: string;
  slug: string;
  emojiAssetName?: string;
  flagAssetName?: string;
};

export const countryConfigs = [
  { country: "Albania", countryCode: "AL", flagEmoji: "🇦🇱", slug: "albania" },
  { country: "Andorra", countryCode: "AD", flagEmoji: "🇦🇩", slug: "andorra" },
  { country: "Armenia", countryCode: "AM", flagEmoji: "🇦🇲", slug: "armenia" },
  { country: "Australia", countryCode: "AU", flagEmoji: "🇦🇺", slug: "australia" },
  { country: "Austria", countryCode: "AT", flagEmoji: "🇦🇹", slug: "austria" },
  { country: "Azerbaijan", countryCode: "AZ", flagEmoji: "🇦🇿", slug: "azerbaijan" },
  { country: "Belarus", countryCode: "BY", flagEmoji: "🇧🇾", slug: "belarus" },
  { country: "Belgium", countryCode: "BE", flagEmoji: "🇧🇪", slug: "belgium" },
  { country: "Bosnia and Herzegovina", countryCode: "BA", flagEmoji: "🇧🇦", slug: "bosnia-and-herzegovina" },
  { country: "Bulgaria", countryCode: "BG", flagEmoji: "🇧🇬", slug: "bulgaria" },
  { country: "Croatia", countryCode: "HR", flagEmoji: "🇭🇷", slug: "croatia" },
  { country: "Cyprus", countryCode: "CY", flagEmoji: "🇨🇾", slug: "cyprus" },
  { country: "Czechia", countryCode: "CZ", flagEmoji: "🇨🇿", slug: "czechia" },
  { country: "Denmark", countryCode: "DK", flagEmoji: "🇩🇰", slug: "denmark" },
  { country: "Estonia", countryCode: "EE", flagEmoji: "🇪🇪", slug: "estonia" },
  { country: "Finland", countryCode: "FI", flagEmoji: "🇫🇮", slug: "finland" },
  { country: "France", countryCode: "FR", flagEmoji: "🇫🇷", slug: "france" },
  { country: "Georgia", countryCode: "GE", flagEmoji: "🇬🇪", slug: "georgia" },
  { country: "Germany", countryCode: "DE", flagEmoji: "🇩🇪", slug: "germany" },
  { country: "Greece", countryCode: "GR", flagEmoji: "🇬🇷", slug: "greece" },
  { country: "Hungary", countryCode: "HU", flagEmoji: "🇭🇺", slug: "hungary" },
  { country: "Iceland", countryCode: "IS", flagEmoji: "🇮🇸", slug: "iceland" },
  { country: "Ireland", countryCode: "IE", flagEmoji: "🇮🇪", slug: "ireland" },
  { country: "Israel", countryCode: "IL", flagEmoji: "🇮🇱", slug: "israel" },
  { country: "Italy", countryCode: "IT", flagEmoji: "🇮🇹", slug: "italy" },
  { country: "Latvia", countryCode: "LV", flagEmoji: "🇱🇻", slug: "latvia" },
  { country: "Lithuania", countryCode: "LT", flagEmoji: "🇱🇹", slug: "lithuania" },
  { country: "Luxembourg", countryCode: "LU", flagEmoji: "🇱🇺", slug: "luxembourg" },
  { country: "Malta", countryCode: "MT", flagEmoji: "🇲🇹", slug: "malta" },
  { country: "Moldova", countryCode: "MD", flagEmoji: "🇲🇩", slug: "moldova" },
  { country: "Monaco", countryCode: "MC", flagEmoji: "🇲🇨", slug: "monaco" },
  { country: "Montenegro", countryCode: "ME", flagEmoji: "🇲🇪", slug: "montenegro" },
  { country: "Morocco", countryCode: "MA", flagEmoji: "🇲🇦", slug: "morocco" },
  { country: "Netherlands", countryCode: "NL", flagEmoji: "🇳🇱", slug: "netherlands" },
  { country: "North Macedonia", countryCode: "MK", flagEmoji: "🇲🇰", slug: "north-macedonia" },
  { country: "Norway", countryCode: "NO", flagEmoji: "🇳🇴", slug: "norway" },
  { country: "Poland", countryCode: "PL", flagEmoji: "🇵🇱", slug: "poland" },
  { country: "Portugal", countryCode: "PT", flagEmoji: "🇵🇹", slug: "portugal" },
  { country: "Romania", countryCode: "RO", flagEmoji: "🇷🇴", slug: "romania" },
  { country: "Russia", countryCode: "RU", flagEmoji: "🇷🇺", slug: "russia" },
  { country: "San Marino", countryCode: "SM", flagEmoji: "🇸🇲", slug: "san-marino" },
  { country: "Serbia", countryCode: "RS", flagEmoji: "🇷🇸", slug: "serbia" },
  {
    country: "Serbia and Montenegro",
    countryCode: "CS",
    flagEmoji: "",
    slug: "serbia-and-montenegro",
  },
  { country: "Slovakia", countryCode: "SK", flagEmoji: "🇸🇰", slug: "slovakia" },
  { country: "Slovenia", countryCode: "SI", flagEmoji: "🇸🇮", slug: "slovenia" },
  { country: "Spain", countryCode: "ES", flagEmoji: "🇪🇸", slug: "spain" },
  { country: "Sweden", countryCode: "SE", flagEmoji: "🇸🇪", slug: "sweden" },
  { country: "Switzerland", countryCode: "CH", flagEmoji: "🇨🇭", slug: "switzerland" },
  { country: "Turkey", countryCode: "TR", flagEmoji: "🇹🇷", slug: "turkey", flagAssetName: "turkey.png" },
  { country: "Ukraine", countryCode: "UA", flagEmoji: "🇺🇦", slug: "ukraine" },
  { country: "United Kingdom", countryCode: "GB", flagEmoji: "🇬🇧", slug: "united-kingdom" },
  {
    country: "Yugoslavia",
    countryCode: "YU",
    flagEmoji: "",
    slug: "yugoslavia",
    emojiAssetName: "yugoslavia1-flag-emoji.png",
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

export const countriesByName = new Map(countryConfigs.map((country) => [country.country, country]));
export const countriesByCode = new Map(countryConfigs.map((country) => [country.countryCode, country]));
export const countriesBySlug = new Map(countryConfigs.map((country) => [country.slug, country]));

export function getCountryConfig(country: string, countryCode?: string) {
  return countriesByName.get(country) ?? (countryCode ? countriesByCode.get(countryCode) : undefined);
}
