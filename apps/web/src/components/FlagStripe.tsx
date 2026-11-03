/**
 * A thin stripe in the German flag's colours: black, red and gold across the top of the login
 * pages. Under the black app header, `afterBlack` leaves out the black band, so the header
 * itself is the flag's black and the stripe adds the red and gold.
 */
export function FlagStripe({ afterBlack = false }: { afterBlack?: boolean }) {
  return (
    <div aria-hidden="true" className="flex h-1">
      {!afterBlack && <span className="flex-1 bg-flag-black" />}
      <span className="flex-1 bg-flag-red" />
      <span className="flex-1 bg-flag-gold" />
    </div>
  );
}
