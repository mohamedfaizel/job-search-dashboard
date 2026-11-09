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
    Raisin | greenhouse:raisin | Berlin
    FlixBus | greenhouse:flix | Munich
    Trade Republic | greenhouse:traderepublicbank | Berlin
    Helsing | greenhouse:helsing | Munich
    Solaris | greenhouse:solarisbank | Berlin
    Moonfare | greenhouse:moonfare | Berlin
    Isar Aerospace | greenhouse:isaraerospace | Munich
    DeepL | ashby:deepl | Cologne
    n8n | ashby:n8n | Berlin
    Langdock | ashby:langdock | Berlin
    Agicap | lever:agicap | Berlin
    Grover | greenhouse:grover | Berlin
  `,
  europe: `
    Adyen | greenhouse:adyen | Amsterdam
    Spotify | lever:spotify | Stockholm
    Intercom | greenhouse:intercom | Dublin
    Wolt | greenhouse:wolt | Helsinki
    Monzo | greenhouse:monzo | London
    GoCardless | greenhouse:gocardless | London
    Typeform | greenhouse:typeform | Barcelona
    Qonto | lever:qonto | Paris
    Datadog (Paris) | greenhouse:datadog | Paris
    Wise | greenhouse:wise | London
    Deliveroo | greenhouse:deliveroo | London
    Trustpilot | greenhouse:trustpilot | Copenhagen
  `,
  ai: `
    Anthropic | greenhouse:anthropic | San Francisco
    OpenAI | ashby:openai | San Francisco
    Cohere | ashby:cohere | Toronto
    Perplexity | ashby:perplexity | San Francisco
    Scale AI | greenhouse:scaleai | San Francisco
    Databricks | greenhouse:databricks | San Francisco
    Runway | ashby:runway | New York
    ElevenLabs | ashby:elevenlabs | London
    Synthesia | ashby:synthesia | London
    PolyAI | greenhouse:polyai | London
    LangChain | ashby:langchain | San Francisco
    Pinecone | ashby:pinecone | New York
    Hex | ashby:hex | San Francisco
    Fivetran | greenhouse:fivetran | Oakland
    Airbyte | ashby:airbyte | San Francisco
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
    Duolingo | greenhouse:duolingo | Pittsburgh
    Instacart | greenhouse:instacart | San Francisco
    Lyft | greenhouse:lyft | San Francisco
    Vercel | greenhouse:vercel | Remote
    Samsara | greenhouse:samsara | San Francisco
    Okta | greenhouse:okta | San Francisco
    Brex | greenhouse:brex | San Francisco
    Gusto | greenhouse:gusto | San Francisco
    Pinterest | greenhouse:pinterest | San Francisco
    Palantir | lever:palantir | Denver
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
