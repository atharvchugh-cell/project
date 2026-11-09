import { Link } from "react-router-dom";

/** Shared by the actual setup screen and its build-time rendering. */
export function RealEstateSetupExplanation() {
  return (
    <section className="space-y-3 text-sm text-muted-foreground" aria-labelledby="property-practice">
      <h2 id="property-practice" className="text-lg font-semibold text-foreground">Practice a property portfolio with virtual money</h2>
      <p>Start with $500,000 in virtual cash and buy or sell whole property units across ten U.S. city markets. Choose four starting cities or let the game choose them. Another city becomes available every two simulated years while cities remain locked.</p>
      <p>The stored city-price tables cover 1990 to 2020. The game selects a random starting year that fits your session. The default session spans 20 years, with one simulated year taking 60 seconds before pauses. Price movement within each year is generated between the stored annual values, not a live property quote.</p>
      <p>After the starting cash, annual deposits begin at $100,000 and rise by $25,000 each year. Compare your ending cash and property value with the money deposited, rather than treating new deposits as profit. Hard Mode blurs year labels; it does not change the price tables.</p>
      <p>This is a simplified educational game, not a property listing service. It does not model mortgages, rent, maintenance, transaction costs or taxes. Properties can be traded immediately, unlike a real home sale. No account is needed to start.</p>
      <p>Read the <Link to="/methodology" className="text-primary underline underline-offset-4">data methodology and limitations</Link> or <Link to="/contact" className="text-primary underline underline-offset-4">contact us about the game</Link>.</p>
    </section>
  );
}