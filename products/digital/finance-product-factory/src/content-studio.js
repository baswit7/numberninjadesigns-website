(() => {
'use strict';

const freezeEntries = entries => Object.freeze(
  Object.fromEntries(entries.map(entry => [entry.id, Object.freeze({ ...entry })])),
);

const CONTEXTS = freezeEntries([
  {
    id: 'numberninjadesigns',
    name: 'NumberNinjaDesigns',
    type: 'master',
    label: 'Merk & studio',
    audience: 'mensen die met slimme, praktische hulpmiddelen tijd willen winnen',
    promise: 'heldere ontwerpen die complexe taken eenvoudiger maken',
    guardrail: 'Gebruik uitsluitend de merknaam NumberNinjaDesigns.',
  },
  {
    id: 'finance-product-factory',
    name: 'Finance Product Factory',
    type: 'digital',
    label: 'Digitaal product',
    audience: 'mensen die grip willen krijgen op hun persoonlijke financiën',
    promise: 'een overzichtelijke digitale workflow voor budget, inzicht en planning',
    guardrail: 'Geen financieel advies, garanties of onbewezen besparingsclaims.',
  },
  {
    id: 'physical-products',
    name: 'Fysieke producten',
    type: 'physical',
    label: 'Fysiek product',
    audience: 'kopers die een functioneel ontwerp in een tastbare uitvoering zoeken',
    promise: 'een verzorgd product met duidelijke maat-, materiaal- en leveringsinformatie',
    guardrail: 'Noem alleen bevestigde materialen, maten, levertijden en producteigenschappen.',
  },
  {
    id: 'tok-hub',
    name: 'TOK Hub',
    type: 'initiative',
    label: 'Initiatief',
    audience: 'makers die ideeën willen structureren en doelgericht willen publiceren',
    promise: 'één werkbare route van onderwerp naar bruikbare content',
    guardrail: 'Publiceer geen trends of platformclaims zonder actuele broncontrole.',
  },
  {
    id: 'boodschappenvergelijker',
    name: 'BoodschappenVergelijker',
    type: 'initiative',
    label: 'Initiatief',
    audience: 'huishoudens die boodschappen praktisch willen vergelijken',
    promise: 'duidelijke vergelijking op basis van controleerbare product- en prijsgegevens',
    guardrail: 'Vermeld peildatum en bron zodra actuele prijzen worden gebruikt.',
  },
  {
    id: 'ai-daytraden',
    name: 'AI Daytraden',
    type: 'research',
    label: 'Onderzoek',
    audience: 'lezers die de rol en beperkingen van AI bij marktanalyse onderzoeken',
    promise: 'nuchtere educatie over data, risico en besluitvorming',
    guardrail: 'Uitsluitend educatief onderzoek; geen financieel advies, signalen of handelsuitvoering.',
  },
  {
    id: 'niveau-verhogen-paul',
    name: 'Niveau Verhogen Paul',
    type: 'initiative',
    label: 'Initiatief',
    audience: 'mensen die hun vaardigheden stap voor stap willen ontwikkelen',
    promise: 'concrete voortgang met een helder en haalbaar leerpad',
    guardrail: 'Doe geen resultaatgaranties en gebruik alleen aantoonbare voortgang.',
  },
  {
    id: 'leersystemen-verkoop',
    name: 'Leersystemen Verkoop',
    type: 'initiative',
    label: 'Initiatief',
    audience: 'teams die verkoopkennis gestructureerd willen opbouwen',
    promise: 'praktische leersystemen die kennis overdraagbaar maken',
    guardrail: 'Gebruik geen klantgegevens zolang privacy- en verwerkingsafspraken niet zijn goedgekeurd.',
  },
]);

const CHANNELS = freezeEntries([
  { id: 'facebook', name: 'Facebook', purpose: 'verhaal, context en gesprek', limit: 2200 },
  { id: 'instagram', name: 'Instagram', purpose: 'visuele aandacht en betrokkenheid', limit: 2200 },
  { id: 'x', name: 'X', purpose: 'één scherp inzicht', limit: 280 },
  { id: 'pinterest', name: 'Pinterest', purpose: 'zoekbare inspiratie en doorklik', limit: 500 },
  { id: 'blog', name: 'Blog', purpose: 'duurzame uitleg en organische vindbaarheid', limit: null },
  { id: 'tiktok', name: 'TikTok', purpose: 'snelle uitleg in beeld', limit: null },
]);

const OBJECTIVES = freezeEntries([
  { id: 'awareness', name: 'Bekendheid', action: 'Ontdek hoe het werkt' },
  { id: 'education', name: 'Uitleg', action: 'Bekijk de praktische aanpak' },
  { id: 'engagement', name: 'Interactie', action: 'Deel jouw aanpak' },
  { id: 'launch', name: 'Lancering', action: 'Bekijk het nieuwe aanbod' },
  { id: 'conversion', name: 'Conversie', action: 'Bekijk de productdetails' },
]);

const clean = (value, maximum = 180) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maximum);

const sentence = value => {
  const text = clean(value);
  if (!text) return '';
  return `${text.charAt(0).toUpperCase()}${text.slice(1).replace(/[.!?]+$/, '')}.`;
};

const compact = (value, maximum) => {
  const text = clean(value, Math.max(maximum * 2, 300));
  if (text.length <= maximum) return text;
  const candidate = text.slice(0, maximum - 1);
  const boundary = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, boundary > maximum * .6 ? boundary : maximum - 1).trim()}…`;
};

const slugify = value => clean(value, 100)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 64);

const hashtag = value => clean(value, 40)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '');

const topicTags = topic => {
  const tags = clean(topic, 80)
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 2)
    .map(hashtag)
    .filter(Boolean);
  return [...new Set(['NumberNinjaDesigns', ...tags])].map(tag => `#${tag}`);
};

const ENGLISH_CONTEXT_COPY = Object.freeze({
  numberninjadesigns: {
    name: 'NumberNinjaDesigns',
    audience: 'people who want to save time with smart, practical tools',
    promise: 'clear designs that make complex tasks easier',
    guardrail: 'Use the NumberNinjaDesigns brand name exclusively.',
  },
  'finance-product-factory': {
    name: 'Finance Product Factory',
    audience: 'people who want more clarity in their personal finances',
    promise: 'a structured digital workflow for budgeting, insight and planning',
    guardrail: 'Do not provide financial advice, guarantees or unverified savings claims.',
  },
  'physical-products': {
    name: 'Physical products',
    audience: 'buyers looking for a functional design in a tangible format',
    promise: 'a polished product with clear size, material and delivery information',
    guardrail: 'Only mention confirmed materials, sizes, delivery times and product properties.',
  },
  'tok-hub': {
    name: 'TOK Hub',
    audience: 'creators who want to structure ideas and publish with purpose',
    promise: 'one practical route from topic to useful content',
    guardrail: 'Do not publish trend or platform claims without checking a current source.',
  },
  boodschappenvergelijker: {
    name: 'Grocery Comparison',
    audience: 'households that want to compare groceries in a practical way',
    promise: 'clear comparisons based on verifiable product and price data',
    guardrail: 'Include a reference date and source whenever current prices are used.',
  },
  'ai-daytraden': {
    name: 'AI Day Trading',
    audience: 'readers researching the role and limitations of AI in market analysis',
    promise: 'balanced education about data, risk and decision-making',
    guardrail: 'Educational research only; no financial advice, trading signals or execution.',
  },
  'niveau-verhogen-paul': {
    name: 'Niveau Verhogen Paul',
    audience: 'people who want to develop their skills step by step',
    promise: 'concrete progress through a clear and achievable learning path',
    guardrail: 'Do not promise results; only use demonstrable progress.',
  },
  'leersystemen-verkoop': {
    name: 'Sales Learning Systems',
    audience: 'teams that want to build sales knowledge systematically',
    promise: 'practical learning systems that make knowledge transferable',
    guardrail: 'Do not use customer data until privacy and processing agreements are approved.',
  },
});

const englishCopy = (context, topic, objective) => ({
  hook: `${sentence(topic)} Made clearer with ${ENGLISH_CONTEXT_COPY[context.id].name}.`,
  body: `${ENGLISH_CONTEXT_COPY[context.id].name} helps ${ENGLISH_CONTEXT_COPY[context.id].audience} with ${ENGLISH_CONTEXT_COPY[context.id].promise}. This post focuses on ${topic}.`,
  cta: ({
    awareness: 'See how it works',
    education: 'Explore the practical approach',
    engagement: 'Share your approach',
    launch: 'Explore the new release',
    conversion: 'View the product details',
  })[objective.id],
});

const dutchCopy = (context, topic, objective) => ({
  hook: `${sentence(topic)} Slimmer aangepakt met ${context.name}.`,
  body: `${context.name} helpt ${context.audience} met ${context.promise}. In deze ${objective.name.toLowerCase()}-content staat ${topic} centraal.`,
  cta: objective.action,
});

function buildContentDraft({
  contextId,
  channelId,
  objectiveId = 'awareness',
  topic,
  locale = 'nl-NL',
  generatedAt = new Date().toISOString(),
} = {}) {
  const context = CONTEXTS[contextId];
  const channel = CHANNELS[channelId];
  const objective = OBJECTIVES[objectiveId];
  const cleanTopic = clean(topic, 120);

  if (!context) throw new TypeError('Kies een geldige productcontext.');
  if (!channel) throw new TypeError('Kies een geldig kanaal.');
  if (!objective) throw new TypeError('Kies een geldig doel.');
  if (cleanTopic.length < 3) throw new TypeError('Vul een onderwerp van minimaal 3 tekens in.');

  const copy = locale === 'en-US'
    ? englishCopy(context, cleanTopic, objective)
    : dutchCopy(context, cleanTopic, objective);
  const isEnglish = locale === 'en-US';
  const displayName = isEnglish ? ENGLISH_CONTEXT_COPY[context.id].name : context.name;
  const publicationGuardrail = isEnglish ? ENGLISH_CONTEXT_COPY[context.id].guardrail : context.guardrail;
  const objectiveLabel = isEnglish
    ? ({ awareness: 'Awareness', education: 'Education', engagement: 'Engagement', launch: 'Launch', conversion: 'Conversion' })[objective.id]
    : objective.name;
  const tags = topicTags(cleanTopic);
  const common = {
    id: `${channel.id}-${slugify(context.name)}-${Date.parse(generatedAt) || 0}`,
    generatedAt,
    locale,
    context: { id: context.id, name: displayName, type: context.type },
    channel: { id: channel.id, name: channel.name },
    objective: objectiveLabel,
    topic: cleanTopic,
    guardrail: publicationGuardrail,
  };

  if (channel.id === 'facebook') {
    return {
      ...common,
      content: {
        opening: copy.hook,
        bericht: `${copy.body}\n\n${copy.cta}.`,
        callToAction: copy.cta,
        hashtags: tags,
        beeldbriefing: isEnglish
          ? `Show ${cleanTopic} in a calm, practical setting. Use navy, off-white and turquoise; do not place unverified claims in the visual.`
          : `Toon ${cleanTopic} in een rustige, concrete gebruikssituatie. Marineblauw, gebroken wit en turquoise; geen onbevestigde claims in beeld.`,
      },
    };
  }

  if (channel.id === 'instagram') {
    return {
      ...common,
      content: {
        caption: `${copy.hook}\n\n${copy.body}\n\n${copy.cta}.`,
        callToAction: copy.cta,
        hashtags: [...tags, ...(isEnglish ? ['#SmartDesign', '#PracticalTools'] : ['#SlimOntwerpen', '#PraktischeTools'])],
        visualBriefing: isEnglish
          ? 'Four-slide carousel: problem, approach, result and next step. Use NumberNinjaDesigns colours and generous whitespace.'
          : 'Carrousel van 4 slides: probleem, aanpak, resultaat, vervolgstap. Gebruik NumberNinjaDesigns-kleuren en veel witruimte.',
        altTekst: isEnglish
          ? `Graphic explanation of ${cleanTopic} by ${displayName}.`
          : `Grafische uitleg over ${cleanTopic} van ${displayName}.`,
      },
    };
  }

  if (channel.id === 'x') {
    const post = compact(`${copy.hook} ${copy.body} ${copy.cta}. ${tags.slice(0, 2).join(' ')}`, 280);
    return { ...common, content: { bericht: post, tekens: post.length } };
  }

  if (channel.id === 'pinterest') {
    return {
      ...common,
      content: {
        titel: compact(`${cleanTopic} | ${displayName}`, 100),
        beschrijving: compact(`${copy.body} ${copy.cta}.`, 500),
        zoekwoorden: [cleanTopic, displayName, isEnglish ? 'searchable inspiration and click-through' : channel.purpose],
        bord: `${displayName} · ${isEnglish ? 'Inspiration' : 'Inspiratie'}`,
        pinBriefing: isEnglish
          ? 'Vertical 2:3 pin with a clear title, one core benefit and subtle NumberNinjaDesigns branding.'
          : 'Verticale pin 2:3 met een duidelijke titel, één kernvoordeel en subtiele NumberNinjaDesigns-branding.',
      },
    };
  }

  if (channel.id === 'blog') {
    return {
      ...common,
      content: {
        seoTitel: compact(`${cleanTopic}: ${isEnglish ? 'a practical approach' : 'een praktische aanpak'} | ${displayName}`, 60),
        metaBeschrijving: compact(`${copy.body} ${copy.cta}.`, 155),
        slug: slugify(`${displayName}-${cleanTopic}`),
        opzet: isEnglish
          ? [
            `Why ${cleanTopic} deserves attention`,
            'The main considerations',
            `The ${displayName} approach`,
            'Practical steps and quality checks',
            'Conclusion and next step',
          ]
          : [
            `Waarom ${cleanTopic} aandacht verdient`,
            'De belangrijkste afwegingen',
            `De aanpak van ${displayName}`,
            'Praktische stappen en controlepunten',
            'Conclusie en volgende stap',
          ],
        callToAction: copy.cta,
      },
    };
  }

  return {
    ...common,
    content: {
      hook: compact(copy.hook, 90),
      scenes: isEnglish
        ? [
          `0–3 sec · Open with the recognisable problem around ${cleanTopic}.`,
          `3–10 sec · Show one practical step from ${displayName}.`,
          '10–18 sec · Show the practical difference without promising results.',
          `18–23 sec · Close with: ${copy.cta}.`,
        ]
        : [
          `0–3 sec · Open met het herkenbare probleem rond ${cleanTopic}.`,
          `3–10 sec · Laat één concrete stap van ${displayName} zien.`,
          '10–18 sec · Toon het praktische verschil zonder resultaatgarantie.',
          `18–23 sec · Sluit af met: ${copy.cta}.`,
        ],
      caption: compact(`${copy.body} ${copy.cta}.`, 220),
      hashtags: [...tags, isEnglish ? '#TikTokExplained' : '#TikTokUitleg'],
      productienotitie: isEnglish
        ? 'Vertical 9:16, captions enabled, calm pacing, rights-cleared audio and a clear end card.'
        : 'Verticaal 9:16, ondertiteling aan, rustig tempo, rechtenvrije audio en een duidelijke eindkaart.',
    },
  };
}

const contentStudioUtils = Object.freeze({ clean, compact, slugify });

globalThis.NumberNinjaContentStudio = Object.freeze({
  CHANNELS,
  CONTEXTS,
  OBJECTIVES,
  buildContentDraft,
  contentStudioUtils,
});
})();
