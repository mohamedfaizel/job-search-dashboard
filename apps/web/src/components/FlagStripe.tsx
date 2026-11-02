/** A thin black, red and gold stripe across the top of every page: the German flag. */
export function FlagStripe() {
  return (
    <div aria-hidden="true" className="flex h-1">
      <span className="flex-1 bg-flag-black" />
      <span className="flex-1 bg-flag-red" />
      <span className="flex-1 bg-flag-gold" />
    </div>
  );
}
