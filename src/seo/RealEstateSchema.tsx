import { Helmet } from "react-helmet-async";

/** Page-specific structured data for /real-estate-game (head tags come from RouteHead). */
export function RealEstateSchema() {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: "Real Estate Game — Rise to Riches",
        url: "https://investmentsimulator.app/real-estate-game",
        description: "Practice trading whole virtual property units across ten U.S. city markets using stored 1990–2020 prices and synthetic within-year moves. Free educational simulation, no account needed; no mortgages or rental income.",
        applicationCategory: "GameApplication",
        genre: ["Simulation", "Educational", "Finance"],
        operatingSystem: "Web Browser",
        gamePlatform: "Web Browser",
        isAccessibleForFree: true,
        inLanguage: "en",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": "https://investmentsimulator.app/#organization" },
      })}</script>
    </Helmet>
  );
}
