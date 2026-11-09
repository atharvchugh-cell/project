import { Helmet } from "react-helmet-async";
import { BASE_URL } from "./routes";

export const HOME_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${BASE_URL}/#application`,
  name: "Rise to Riches",
  url: `${BASE_URL}/`,
  description: "Free educational investing simulation with virtual money and historical annual returns. Within-year price moves are synthetic. Solo play needs no account. This is not a real brokerage or investment advice.",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web Browser",
  browserRequirements: "Requires JavaScript",
  isAccessibleForFree: true,
  inLanguage: "en",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": `${BASE_URL}/#organization` },
  isPartOf: { "@id": `${BASE_URL}/#website` },
};

export function HomeApplicationSchema() {
  return <Helmet><script type="application/ld+json">{JSON.stringify(HOME_APPLICATION)}</script></Helmet>;
}