# Scaling Strategy

## Doel
De scalingstrategie voorkomt dat de software factory groeit in losse projecten, dubbele systemen en onduidelijke afhankelijkheden. Schaalbaarheid wordt beoordeeld op product-, repository-, team-, data-, deployment- en AI-contextniveau.

## Schaalniveaus
| Niveau | Focus | Belangrijkste risico |
| --- | --- | --- |
| Project | Een product zelfstandig laten groeien | Feature spaghetti |
| Portfolio | Meerdere producten tegelijk besturen | Prioriteitschaos |
| Shared Systems | Hergebruik zonder coupling | Breekbare centrale modules |
| Cloud | Deployments en secrets beheren | Productiechaos |
| AI Context | Agents efficient laten werken | Tokenoverload |
| Commercial | Omzet herhaalbaar maken | Support en operations bottlenecks |

## Modularisatiebeleid
- Start projectspecifiek tenzij hergebruik aantoonbaar is.
- Promoveer naar `shared/` pas na contract, owner en versiebeleid.
- Splits grote HTML of scriptbestanden zodra onderhoud, performance of contextleesbaarheid lijdt.
- Houd runtime dependencies minimaal en expliciet.

## Data Scaling
Voor datasets, analytics en API-integraties:
- definieer bron, eigenaar, updatefrequentie en retentie;
- vermijd onbegrensde localStorage of client-side verwerking;
- documenteer cache invalidatie;
- ontwerp pagination, batching of queues voordat volume kritisch wordt.

## Deployment Scaling
Elke deploybare app krijgt:
- environment strategy;
- preview deployment;
- production deployment;
- rollback procedure;
- secrets mapping;
- observability baseline;
- release checklist.

## Operational Scaling
Herhaalbare handmatige taken worden automation candidates als:
- ze vaker dan drie keer terugkomen;
- ze foutgevoelig zijn;
- ze release of omzet vertragen;
- ze duidelijke input/output hebben;
- risico's met retries en fallback beheersbaar zijn.

## Portfolio Prioritization
Projecten worden gerangschikt op:
- revenue potential;
- launch readiness;
- strategic leverage;
- effort to validate;
- technical risk;
- reusable learning value.

## Scaling Blockers
- ongedocumenteerde APIs;
- secrets in repository;
- projectoverstijgende code zonder contract;
- geen rollback voor productie;
- lage documentation health;
- hoge technical debt score;
- commercial score zonder bewijs.
