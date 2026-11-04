// Reads whether a job is in the United States from the location text job boards give, or leaves it undecided.
const STATE_CODES = new Set(
  ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK " +
    "OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR").split(" "),
)

const STATE_NAMES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|" +
  "Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|" +
  "Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|" +
  "Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|" +
  "West Virginia|Wisconsin|Wyoming|Puerto Rico"

const US_WORDS = new RegExp(`\\b(United States|USA|U\\.S\\.A?\\.?|US|D\\.C\\.|${STATE_NAMES})(?![a-z])`)

const OTHER_COUNTRIES = new RegExp(
  "\\b(" +
    "Argentina|Australia|Austria|Belgium|Brazil|Bulgaria|Canada|Chile|China|Colombia|Costa Rica|Croatia|Czech Republic|" +
    "Czechia|Denmark|Egypt|Estonia|Finland|France|Germany|Greece|Hong Kong|Hungary|India|Indonesia|Ireland|Israel|" +
    "Italy|Japan|Kenya|Korea|Latvia|Lithuania|Luxembourg|Malaysia|Mexico|Morocco|Netherlands|New Zealand|Nigeria|" +
    "Norway|Pakistan|Peru|Philippines|Poland|Portugal|Romania|Saudi Arabia|Serbia|Singapore|Slovakia|South Africa|" +
    "Spain|Sweden|Switzerland|Taiwan|Thailand|Turkey|Ukraine|United Arab Emirates|UAE|United Kingdom|UK|England|" +
    "Scotland|Uruguay|Vietnam" +
    ")\\b",
)

// Returns the country of one location: "US", "other", or undefined when the text does not say.
function countryOfLocation(location: string): "US" | "other" | undefined {
  if (US_WORDS.test(location)) return "US"

  const codeAfterComma = location.match(/,\s*([A-Z]{2})\b/)
  if (codeAfterComma && STATE_CODES.has(codeAfterComma[1]!)) return "US"

  return OTHER_COUNTRIES.test(location) ? "other" : undefined
}

// Returns "US" when any location is in the United States, "other" when one is clearly elsewhere, else undefined.
export function countryOf(locations: readonly string[]): "US" | "other" | undefined {
  const countries = locations.map(countryOfLocation)
  if (countries.includes("US")) return "US"
  return countries.includes("other") ? "other" : undefined
}
