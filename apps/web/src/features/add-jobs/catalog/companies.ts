/**
 * Companies whose career pages we can read (Greenhouse, Lever, Ashby), to pick from on the
 * Company career pages import. A company can move to another hiring tool: the import then names
 * the boards it could not read, and you remove them. Grouped so you can add a whole group.
 */

export type CatalogGroup = 'germany' | 'europe' | 'ai' | 'global';

export interface CatalogCompany {
  name: string;
  /** What the import reads: "greenhouse:stripe". */
  board: string;
  group: CatalogGroup;
  /** Head office or main hiring place. */
  place: string;
}

export const CATALOG_GROUPS: CatalogGroup[] = ['germany', 'europe', 'ai', 'global'];

/** One company per line: "Name | ats:slug | Place". */
const LISTS: Record<CatalogGroup, string> = {
  germany: `
    N26 | greenhouse:n26 | Berlin
    GetYourGuide | greenhouse:getyourguide | Berlin
    HelloFresh | greenhouse:hellofresh | Berlin
    Contentful | greenhouse:contentful | Berlin
    Celonis | greenhouse:celonis | Munich
    SumUp | greenhouse:sumup | Berlin
    Babbel | greenhouse:babbel | Berlin
    Taxfix | greenhouse:taxfix | Berlin
    Raisin | greenhouse:raisin | Berlin
    FlixBus | greenhouse:flix | Munich
    Trade Republic | greenhouse:traderepublicbank | Berlin
    Scalable Capital | greenhouse:scalablecapital | Munich
    Enpal | greenhouse:enpal | Berlin
    1Komma5° | greenhouse:1komma5grad | Hamburg
    Pitch | greenhouse:pitch | Berlin
    Helsing | greenhouse:helsing | Munich
    Personio | greenhouse:personio | Munich
    Solaris | greenhouse:solarisbank | Berlin
    Sennder | lever:sennder | Berlin
    Forto | greenhouse:forto | Berlin
    Tier Mobility | greenhouse:tier | Berlin
    Mambu | greenhouse:mambu | Berlin
    Moonfare | greenhouse:moonfare | Berlin
    Billie | greenhouse:billie | Berlin
    Wefox | greenhouse:wefox | Berlin
    Quantum Systems | greenhouse:quantumsystems | Munich
    Isar Aerospace | greenhouse:isaraerospace | Munich
    Parloa | greenhouse:parloa | Berlin
    Aleph Alpha | greenhouse:alephalpha | Heidelberg
    DeepL | ashby:deepl | Cologne
    n8n | ashby:n8n | Berlin
    Langdock | ashby:langdock | Berlin
    Black Forest Labs | greenhouse:blackforestlabs | Freiburg
    Agicap | lever:agicap | Berlin
    Zeit Online | greenhouse:zeitonline | Hamburg
    Freeletics | greenhouse:freeletics | Munich
    Tado | greenhouse:tado | Munich
    Grover | greenhouse:grover | Berlin
    Ecosia | greenhouse:ecosia | Berlin
    Pliant | greenhouse:pliant | Berlin
  `,
  europe: `
    Adyen | greenhouse:adyen | Amsterdam
    Spotify | lever:spotify | Stockholm
    Intercom | greenhouse:intercom | Dublin
    Wolt | greenhouse:wolt | Helsinki
    Pleo | greenhouse:pleo | Copenhagen
    Mollie | greenhouse:mollie | Amsterdam
    Bolt | greenhouse:bolt | Tallinn
    Revolut | lever:revolut | London
    Monzo | greenhouse:monzo | London
    Checkout.com | greenhouse:checkoutcom | London
    GoCardless | greenhouse:gocardless | London
    Typeform | greenhouse:typeform | Barcelona
    Glovo | greenhouse:glovo | Barcelona
    Doctolib | greenhouse:doctolib | Paris
    Qonto | lever:qonto | Paris
    Alan | lever:alan | Paris
    BlaBlaCar | greenhouse:blablacar | Paris
    Datadog (Paris) | greenhouse:datadog | Paris
    Miro | greenhouse:miro | Amsterdam
    Booking.com | greenhouse:bookingcom | Amsterdam
    Mistral AI | lever:mistral | Paris
    Pipedrive | greenhouse:pipedrive | Tallinn
    Wise | greenhouse:wise | London
    Deliveroo | greenhouse:deliveroo | London
    Trustpilot | greenhouse:trustpilot | Copenhagen
    Klarna | greenhouse:klarna | Stockholm
    Vinted | greenhouse:vinted | Vilnius
    Aiven | greenhouse:aiven | Helsinki
    Supercell | greenhouse:supercell | Helsinki
  `,
  ai: `
    Anthropic | greenhouse:anthropic | San Francisco
    OpenAI | ashby:openai | San Francisco
    Cohere | ashby:cohere | Toronto
    Perplexity | ashby:perplexity | San Francisco
    Scale AI | greenhouse:scaleai | San Francisco
    Databricks | greenhouse:databricks | San Francisco
    DeepMind | greenhouse:deepmind | London
    Runway | ashby:runway | New York
    ElevenLabs | ashby:elevenlabs | London
    Synthesia | ashby:synthesia | London
    PolyAI | greenhouse:polyai | London
    LangChain | ashby:langchain | San Francisco
    Pinecone | ashby:pinecone | New York
    Weights & Biases | lever:wandb | San Francisco
    Hex | ashby:hex | San Francisco
    dbt Labs | greenhouse:dbtlabsinc | Philadelphia
    Fivetran | greenhouse:fivetran | Oakland
    Airbyte | ashby:airbyte | San Francisco
    ClickHouse | greenhouse:clickhouse | Amsterdam
    Snowflake | ashby:snowflake | Bozeman
  `,
  global: `
    Stripe | greenhouse:stripe | Dublin
    GitLab | greenhouse:gitlab | Remote
    Cloudflare | greenhouse:cloudflare | Lisbon
    Figma | greenhouse:figma | San Francisco
    Airbnb | greenhouse:airbnb | San Francisco
    Dropbox | greenhouse:dropbox | Remote
    Reddit | greenhouse:reddit | San Francisco
    Discord | greenhouse:discord | San Francisco
    Coinbase | greenhouse:coinbase | Remote
    Airtable | greenhouse:airtable | San Francisco
    Twilio | greenhouse:twilio | Remote
    MongoDB | greenhouse:mongodb | Dublin
    Elastic | greenhouse:elastic | Remote
    Grammarly | greenhouse:grammarly | Berlin
    Duolingo | greenhouse:duolingo | Pittsburgh
    Instacart | greenhouse:instacart | San Francisco
    Lyft | greenhouse:lyft | San Francisco
    Vercel | greenhouse:vercel | Remote
    Samsara | greenhouse:samsara | San Francisco
    Okta | greenhouse:okta | San Francisco
    Brex | greenhouse:brex | San Francisco
    Gusto | greenhouse:gusto | San Francisco
    Pinterest | greenhouse:pinterest | San Francisco
    Netflix | lever:netflix | Los Gatos
    Palantir | lever:palantir | Denver
    Plaid | lever:plaid | San Francisco
    Ramp | ashby:ramp | New York
    Notion | ashby:notion | San Francisco
    Linear | ashby:linear | Remote
    Vanta | ashby:vanta | Remote
    PostHog | ashby:posthog | Remote
    Supabase | ashby:supabase | Remote
    Deel | ashby:deel | Remote
    Zapier | ashby:zapier | Remote
    Automattic | greenhouse:automatticcareers | Remote
  `,
};

export const COMPANY_CATALOG: CatalogCompany[] = CATALOG_GROUPS.flatMap((group) =>
  LISTS[group]
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([name]) => name)
    .map(([name = '', board = '', place = '']) => ({ name, board, group, place })),
);
