# AI Native Revenue System

## Doel
Het AI Native Revenue System zorgt dat de factory bouwt op commerciele intelligentie in plaats van gokwerk. Productbeslissingen worden gestuurd door vraag, bereidheid om te betalen, conversie, kanaalfit, operationele complexiteit en herhaalbare omzet.

## Commercial Data Model
| Entity | Fields |
| --- | --- |
| Market | audience, pain, urgency, alternatives, saturation |
| Offer | promise, target buyer, use case, differentiation |
| Pricing Hypothesis | model, price point, package, margin, confidence |
| Channel | SEO, social, paid, marketplace, outbound, partner |
| Experiment | hypothesis, metric, sample, result, decision |
| Funnel | visitor, lead, trial, activation, paid, retained |
| Revenue Risk | support load, API cost, compliance, competition |

## Revenue Scoring
```text
revenue_score =
  demand * 0.20 +
  pain_severity * 0.15 +
  willingness_to_pay * 0.20 +
  channel_fit * 0.15 +
  margin_potential * 0.10 +
  recurring_potential * 0.10 +
  differentiation * 0.10
  - operational_complexity_penalty
```

Operational complexity penalty:
- 0: static product, low support;
- 5: lightweight integration;
- 10: recurring support or API dependency;
- 20: regulated, high support or fragile external systems.

## Validation Loops
| Loop | Question | Minimum Evidence |
| --- | --- | --- |
| Demand | Does the market search or ask for this? | Keyword, community, direct buyer or competitor signal |
| Pain | Is the problem urgent enough? | Interview, complaint, support thread or paid workaround |
| Offer | Is the promise clear? | Landing page CTR, waitlist, replies or demo requests |
| Price | Will buyers pay? | Preorder, paid pilot, quote acceptance or sales call signal |
| Delivery | Can value be delivered efficiently? | MVP usage, manual delivery, support load |
| Retention | Does value repeat? | Repeat usage, renewal intent or reorder |
| Scale | Can acquisition repeat? | Channel conversion and CAC estimate |

## Experiment Framework
Every experiment must define:
- hypothesis;
- audience;
- channel;
- offer;
- primary metric;
- success threshold;
- maximum cost;
- decision rule;
- next action for win, loss or inconclusive result.

## Monetization Models
| Model | Best Fit | Watchpoint |
| --- | --- | --- |
| Subscription SaaS | Repeated workflow value | Retention and support |
| Usage based | AI generation or data processing | Unit economics and cost caps |
| One-time product | Templates, static tools, downloadable assets | Limited lifetime value |
| Service-assisted SaaS | High-value B2B workflows | Delivery scalability |
| Marketplace | Etsy, templates, creator products | Platform dependency |
| Lead generation | Comparison and niche research sites | Tracking quality and partner risk |
| Affiliate | SEO-heavy product discovery | Margin and compliance |

## Launch Strategies
| Strategy | When To Use | Success Signal |
| --- | --- | --- |
| Validation landing page | Before heavy build | Lead conversion or buyer replies |
| Concierge MVP | Complex workflow with uncertain automation | Users pay or request repeat delivery |
| SEO cluster launch | Search demand exists | Indexed pages and qualified clicks |
| Social proof launch | Visual or creator product | Saves, shares, comments, waitlist |
| Paid pilot | B2B or high-value automation | Signed pilot or LOI |
| Marketplace test | Productized digital goods | Conversion and review quality |

## Commercial Prioritization
Build first when:
- revenue score is high;
- complexity risk is controlled;
- validation path is fast;
- reusable systems can compound;
- distribution channel is known;
- support burden is low or automatable.

Delay when:
- target buyer is unclear;
- no demand signal exists;
- integrations are fragile;
- unit economics are unknown;
- product requires large build before validation.
