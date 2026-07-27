const V = '1.0.0';
const freeze = value => Object.freeze(value);
const list = values => freeze(values);

const LOCALES = list(['nl-NL', 'en-US', 'en-GB']);
const CURRENCIES = list(['EUR', 'USD', 'GBP']);
const THEMES = list(['modern-minimal', 'executive-navy']);
const PAGE = freeze({ size: 'A4', orientation: 'portrait', margins: freeze({ top: 0.8, right: 0.8, bottom: 0.8, left: 0.8 }) });
const STANDARD_STYLE = freeze({ preset: 'standard-business-brief', baseFont: 'Calibri', bodySize: 11, titleSize: 24, headingColor: '#2E74B5', accentColor: '#0B2545', lineSpacing: 1.1 });
const ATS_STYLE = freeze({ preset: 'ats-minimal', baseFont: 'Arial', bodySize: 10.5, titleSize: 23, headingColor: '#000000', accentColor: '#000000', lineSpacing: 1.1 });

const p = (text, style = 'normal') => freeze({ type: 'paragraph', style, text });
const h = (text, level = 2) => freeze({ type: 'heading', level, text });
const bullets = (...items) => freeze({ type: 'list', ordered: false, items: list(items) });
const numbered = (...items) => freeze({ type: 'list', ordered: true, items: list(items) });
const table = (columns, rows, columnWidths) => freeze({ type: 'table', columns: list(columns), rows: list(rows.map(row => list(row))), columnWidths: list(columnWidths) });
const section = (id, title, blocks, pageBreakBefore = false) => freeze({ id, ...(title ? { title } : {}), blocks: list(blocks), ...(pageBreakBefore ? { pageBreakBefore: true } : {}) });

function placeholders(language) {
  const nl = language === 'nl';
  const labels = {
    candidate_name: nl ? 'Naam kandidaat' : 'Candidate name',
    phone: nl ? 'Telefoonnummer' : 'Phone number',
    email: nl ? 'E-mailadres' : 'Email address',
    location: nl ? 'Woonplaats' : 'Location',
    linkedin: 'LinkedIn',
    portfolio: 'Portfolio',
    professional_profile: nl ? 'Professioneel profiel' : 'Professional profile',
    job_title: nl ? 'Functietitel' : 'Job title',
    company_name: nl ? 'Bedrijfsnaam' : 'Company name',
    contact_person: nl ? 'Contactpersoon' : 'Contact person',
    vacancy_source: nl ? 'Vacaturebron' : 'Vacancy source',
    date: nl ? 'Datum' : 'Date',
    place: nl ? 'Plaats' : 'Place',
    experience_summary: nl ? 'Relevante ervaring' : 'Relevant experience',
    competency: nl ? 'Kerncompetentie' : 'Core competency',
    achievement: nl ? 'Gecontroleerde prestatie' : 'Verified achievement',
    organization_motivation: nl ? 'Motivatie voor de organisatie' : 'Motivation for the organization',
    employer: nl ? 'Werkgever' : 'Employer',
    employment_dates: nl ? 'Werkperiode' : 'Employment dates',
    education: nl ? 'Opleiding' : 'Education',
    certificate: nl ? 'Certificaat' : 'Certificate',
    project: nl ? 'Project' : 'Project',
    hard_skills: nl ? 'Hard skills' : 'Hard skills',
    soft_skills: nl ? 'Soft skills' : 'Soft skills',
    languages: nl ? 'Talen' : 'Languages',
    software: nl ? 'Softwarekennis' : 'Software knowledge',
    references: nl ? 'Referenties' : 'References',
    call_to_action: nl ? 'Afsluitende call to action' : 'Closing call to action',
    salary_target: nl ? 'Salarisdoel' : 'Salary target',
    evidence: nl ? 'Onderbouwing' : 'Evidence',
  };
  return list(Object.entries(labels).map(([id, label]) => freeze({
    id: id.replaceAll('_', '-'),
    token: `{{${id}}}`,
    label,
    required: ['candidate_name', 'email'].includes(id),
    instructions: nl ? `Vervang door gecontroleerde eigen informatie voor: ${label.toLowerCase()}.` : `Replace with verified personal information for: ${label.toLowerCase()}.`,
  })));
}

function documentTemplate({ id, language, title, filename, sections, role = 'template', requiredText = [], preset = STANDARD_STYLE }) {
  const nl = language === 'nl';
  const documentText = JSON.stringify(sections);
  const scopedPlaceholders = placeholders(language).map(placeholder => freeze({
    ...placeholder,
    required: placeholder.required && documentText.includes(placeholder.token),
  }));
  return freeze({
    schemaVersion: V,
    id,
    title,
    language,
    filename,
    metadata: freeze({ subject: title, description: nl ? 'Volledig bewerkbaar professioneel template.' : 'Fully editable professional template.', category: 'career-template', keywords: list(['career', 'job-application', 'editable-template']) }),
    footer: freeze({ text: nl ? 'Vervang alle gemarkeerde placeholders voor gebruik' : 'Replace all highlighted placeholders before use', includePageNumber: true }),
    sections: list(sections),
    placeholders: list(scopedPlaceholders),
    page: PAGE,
    styles: preset,
    packaging: freeze({ relativePath: `${language}/${filename}`, role }),
    requiredText: list(requiredText),
    extensions: freeze({ headerPattern: 'customer-pack', declaredPlaceholdersRemainEditable: true, pdfExport: 'NOT_IMPLEMENTED' }),
  });
}

const CV_VARIANTS = list([
  ['ats-friendly', 'ATS Friendly CV', 'ATS-vriendelijk CV', 'Clear one-column structure with conventional headings.', 'Duidelijke éénkolomsstructuur met gangbare koppen.'],
  ['modern-professional', 'Modern Professional CV', 'Modern professioneel CV', 'Balanced profile, experience, skills, and selected projects.', 'Gebalanceerd profiel met ervaring, vaardigheden en geselecteerde projecten.'],
  ['executive', 'Executive CV', 'Executive CV', 'Leadership scope, strategic outcomes, and governance experience.', 'Leiderschap, strategische resultaten en governance-ervaring.'],
  ['project-manager', 'Project Manager CV', 'Projectmanager CV', 'Delivery governance, scope, planning, risks, and stakeholder leadership.', 'Deliverygovernance, scope, planning, risico’s en stakeholdermanagement.'],
  ['product-owner', 'Product Owner CV', 'Product Owner CV', 'Product vision, prioritization, discovery, and measurable outcomes.', 'Productvisie, prioritering, discovery en meetbare resultaten.'],
  ['business-analyst', 'Business Analyst CV', 'Business Analyst CV', 'Requirements, process analysis, traceability, and business outcomes.', 'Requirements, procesanalyse, traceability en bedrijfsresultaten.'],
  ['starter', 'Starter CV', 'Starter CV', 'Education, projects, transferable skills, and realistic potential.', 'Opleiding, projecten, overdraagbare vaardigheden en realistisch potentieel.'],
]);

function cvTemplate(language, variant) {
  const [id, enTitle, nlTitle, enFocus, nlFocus] = variant;
  const nl = language === 'nl';
  const title = nl ? nlTitle : enTitle;
  const focus = nl ? nlFocus : enFocus;
  const ats = id === 'ats-friendly';
  const roleGuidance = {
    executive: nl ? 'Benoem span of control, besluitvorming, transformaties en aantoonbare organisatieresultaten.' : 'Describe span of control, decision ownership, transformations, and verified organizational outcomes.',
    'project-manager': nl ? 'Benoem projectomvang, planning, budget, governance, risico’s en stakeholders zonder ongefundeerde claims.' : 'Describe project scale, schedule, budget, governance, risks, and stakeholders without unsupported claims.',
    'product-owner': nl ? 'Benoem productdoel, backlogbesluiten, klantinzichten en geverifieerde productresultaten.' : 'Describe product goals, backlog decisions, customer insight, and verified product outcomes.',
    'business-analyst': nl ? 'Benoem requirements, procesverbetering, traceability en besluitondersteuning.' : 'Describe requirements, process improvement, traceability, and decision support.',
    starter: nl ? 'Zet opleiding, stage, projecten en overdraagbare vaardigheden voorop; verzin geen werkervaring.' : 'Lead with education, internships, projects, and transferable skills; never invent work experience.',
  }[id] ?? (nl ? 'Kies alleen relevante en controleerbare informatie.' : 'Include only relevant, verifiable information.');
  const skillsBlock = ats
    ? bullets('{{hard_skills}}', '{{soft_skills}}', '{{languages}}', '{{software}}')
    : table(nl ? ['Onderdeel', 'Inhoud'] : ['Area', 'Content'], [[nl ? 'Hard skills' : 'Hard skills', '{{hard_skills}}'], [nl ? 'Soft skills' : 'Soft skills', '{{soft_skills}}'], [nl ? 'Talen' : 'Languages', '{{languages}}'], [nl ? 'Software' : 'Software', '{{software}}']], [2500, 6860]);
  return documentTemplate({
    id: `cv-${id}-${language}`,
    language,
    title,
    filename: `${language}-${id}-cv-template.docx`,
    preset: ats ? ATS_STYLE : STANDARD_STYLE,
    requiredText: [title],
    sections: [
      section('instructions', nl ? 'Invulinstructie' : 'Completion guide', [p(focus, 'lead'), p(roleGuidance, 'note'), numbered(nl ? 'Vervang alle gemarkeerde placeholders.' : 'Replace every highlighted placeholder.', nl ? 'Schrijf prestaties als controleerbaar feit en voeg context toe.' : 'Write achievements as verifiable facts with context.', nl ? 'Verwijder deze instructies vóór verzending.' : 'Remove these instructions before sending.')]),
      section('identity', null, [h('{{candidate_name}}', 1), p('{{phone}} | {{email}} | {{location}} | {{linkedin}} | {{portfolio}}', 'muted')]),
      section('profile', nl ? 'Profiel' : 'Professional profile', [p('{{professional_profile}}')]),
      section('experience', nl ? 'Werkervaring' : 'Professional experience', [h('{{job_title}} — {{employer}}', 2), p('{{employment_dates}}', 'muted'), bullets('{{experience_summary}}', '{{achievement}}')]),
      section('education', nl ? 'Opleiding en certificaten' : 'Education and certifications', [p('{{education}}'), p('{{certificate}}')]),
      section('projects', nl ? 'Projecten en prestaties' : 'Projects and achievements', [p('{{project}}'), p('{{achievement}}')]),
      section('skills', nl ? 'Vaardigheden' : 'Skills', [skillsBlock]),
      section('additional', nl ? 'Aanvullend' : 'Additional information', [p(nl ? 'Vrijwilligerswerk/publicaties: {{experience_summary}}' : 'Volunteering/publications: {{experience_summary}}'), p(nl ? 'Referenties: {{references}}' : 'References: {{references}}')]),
    ],
  });
}

const LETTER_FORMS = list([
  ['formal', 'Formal Motivation Letter', 'Formele motivatiebrief'],
  ['modern', 'Modern Motivation Letter', 'Moderne motivatiebrief'],
  ['short-cover', 'Short Cover Letter', 'Korte begeleidende brief'],
  ['open-application', 'Open Application Letter', 'Open sollicitatiebrief'],
  ['internal', 'Internal Application Letter', 'Interne sollicitatiebrief'],
  ['career-switch', 'Career Change Letter', 'Brief voor carrièreswitch'],
  ['starter', 'Starter Motivation Letter', 'Motivatiebrief voor starters'],
  ['senior-executive', 'Senior or Executive Letter', 'Senior- of executivebrief'],
]);

function letterTemplate(language, form) {
  const [id, enTitle, nlTitle] = form;
  const nl = language === 'nl';
  const title = nl ? nlTitle : enTitle;
  const context = {
    formal: nl ? 'Zakelijk, precies en maximaal één functionele pagina.' : 'Formal, precise, and no longer than one functional page.',
    modern: nl ? 'Directe opening, concrete aansluiting en natuurlijke professionele toon.' : 'Direct opening, concrete fit, and a natural professional tone.',
    'short-cover': nl ? 'Beknopte brief voor een sollicitatieportaal of snelle introductie.' : 'Concise letter for an application portal or brief introduction.',
    'open-application': nl ? 'Leg uit welk probleem of werkgebied je kunt ondersteunen zonder een vacature te veronderstellen.' : 'Explain the work area or problem you can support without assuming a vacancy exists.',
    internal: nl ? 'Benoem interne kennis en groei zonder vertrouwelijke informatie te delen.' : 'Use internal knowledge and growth evidence without disclosing confidential information.',
    'career-switch': nl ? 'Maak overdraagbare ervaring expliciet; doe geen ervaring voor die je niet hebt.' : 'Make transferable experience explicit; do not imply experience you do not have.',
    starter: nl ? 'Gebruik opleiding, stage en projecten als bewijs; verzin geen senioriteit.' : 'Use education, internships, and projects as evidence; never invent seniority.',
    'senior-executive': nl ? 'Koppel leiderschapsomvang en organisatieresultaten aan de strategische opdracht.' : 'Connect leadership scope and organizational outcomes to the strategic mandate.',
  }[id];
  return documentTemplate({
    id: `letter-${id}-${language}`,
    language,
    title,
    filename: `${language}-${id}-motivation-letter.docx`,
    role: 'message',
    requiredText: [title],
    sections: [
      section('guide', nl ? 'Gebruik' : 'Use', [p(context, 'note'), p(nl ? 'Vervang placeholders, controleer iedere claim en verwijder deze instructie vóór verzending.' : 'Replace placeholders, verify every claim, and remove this guidance before sending.')]),
      section('address', null, [p('{{candidate_name}} | {{location}} | {{phone}} | {{email}}', 'muted'), p('{{place}}, {{date}}'), p(nl ? 'Aan: {{contact_person}}, {{company_name}}' : 'To: {{contact_person}}, {{company_name}}')]),
      section('subject', null, [h(nl ? 'Betreft: sollicitatie {{job_title}}' : 'Re: application for {{job_title}}', 1)]),
      section('letter', null, [
        p(nl ? 'Geachte {{contact_person}},' : 'Dear {{contact_person}},'),
        p(nl ? 'Via {{vacancy_source}} zag ik de mogelijkheid voor {{job_title}} bij {{company_name}}. De combinatie van {{organization_motivation}} en mijn ervaring met {{experience_summary}} vormt voor mij een concrete reden om te reageren.' : 'I found the {{job_title}} opportunity at {{company_name}} through {{vacancy_source}}. The combination of {{organization_motivation}} and my experience in {{experience_summary}} gives me a concrete reason to apply.'),
        p(nl ? 'Een relevante bijdrage is {{achievement}}. Dit voorbeeld is uitsluitend bedoeld als plaats voor een controleerbare eigen prestatie. Mijn kerncompetentie {{competency}} sluit aan op de belangrijkste verantwoordelijkheid van de functie.' : 'One relevant contribution is {{achievement}}. This placeholder must be replaced by a verifiable personal achievement. My core competency in {{competency}} aligns with a central responsibility of the role.'),
        p(nl ? 'Graag licht ik mijn motivatie en aansluiting in een gesprek toe. {{call_to_action}}' : 'I would welcome the opportunity to discuss my motivation and fit. {{call_to_action}}'),
        p(nl ? 'Met vriendelijke groet,\n{{candidate_name}}' : 'Kind regards,\n{{candidate_name}}'),
      ]),
    ],
  });
}

const ROLE_DIRECTIONS = list([
  ['project-manager', 'Project Manager', 'Projectmanager', 'scope, planning, governance, risks, budget, and stakeholders', 'scope, planning, governance, risico’s, budget en stakeholders'],
  ['product-owner', 'Product Owner', 'Product Owner', 'product vision, prioritization, discovery, and value delivery', 'productvisie, prioritering, discovery en waardelevering'],
  ['business-analyst', 'Business Analyst', 'Business Analyst', 'requirements, processes, traceability, and decision support', 'requirements, processen, traceability en besluitondersteuning'],
  ['developer', 'Developer', 'Developer', 'maintainable delivery, code quality, collaboration, and operational reliability', 'onderhoudbare software, codekwaliteit, samenwerking en operationele betrouwbaarheid'],
  ['engineer', 'Engineer', 'Engineer', 'technical design, safety, quality, and evidence-based problem solving', 'technisch ontwerp, veiligheid, kwaliteit en evidence-based probleemoplossing'],
  ['manager', 'Manager', 'Manager', 'people leadership, priorities, performance, and change', 'mensgericht leiderschap, prioriteiten, prestaties en verandering'],
  ['logistics', 'Logistics Professional', 'Logistiek medewerker', 'flow, accuracy, safety, planning, and continuous improvement', 'goederenstroom, nauwkeurigheid, veiligheid, planning en continu verbeteren'],
  ['administration', 'Administrative Professional', 'Administratief medewerker', 'accuracy, coordination, records, service, and deadline control', 'nauwkeurigheid, coördinatie, dossiervorming, service en deadlinebewaking'],
  ['finance', 'Finance Professional', 'Finance professional', 'controls, analysis, reporting, accuracy, and business partnership', 'controls, analyse, rapportage, nauwkeurigheid en business partnership'],
  ['starter', 'Starter', 'Starter', 'education, projects, internships, learning ability, and transferable skills', 'opleiding, projecten, stages, leervermogen en overdraagbare vaardigheden'],
  ['senior', 'Senior Professional', 'Senior professional', 'depth, judgment, mentoring, and sustained verified outcomes', 'vakinhoudelijke diepgang, oordeelsvorming, mentoring en aantoonbare resultaten'],
  ['executive', 'Executive', 'Executive', 'strategic mandate, governance, leadership scale, and organizational outcomes', 'strategische opdracht, governance, leiderschapsomvang en organisatieresultaten'],
]);

function roleDirectionTemplate(language) {
  const nl = language === 'nl';
  return documentTemplate({
    id: `role-direction-letters-${language}`,
    language,
    title: nl ? 'Functiegerichte motivatiebrieven' : 'Role-Specific Motivation Letters',
    filename: `${language}-role-specific-letter-templates.docx`,
    role: 'message',
    requiredText: [nl ? 'Functiegerichte motivatiebrieven' : 'Role-Specific Motivation Letters'],
    sections: ROLE_DIRECTIONS.map((role, index) => {
      const [, enTitle, nlTitle, enFocus, nlFocus] = role;
      const roleTitle = nl ? nlTitle : enTitle;
      const focus = nl ? nlFocus : enFocus;
      return section(`role-${role[0]}`, roleTitle, [
        p(nl ? `Gebruik aantoonbare voorbeelden voor ${focus}.` : `Use verifiable examples covering ${focus}.`, 'note'),
        p(nl ? 'Geachte {{contact_person}},' : 'Dear {{contact_person}},'),
        p(nl ? `De functie ${roleTitle} bij {{company_name}} spreekt mij aan vanwege {{organization_motivation}}. Mijn relevante basis is {{experience_summary}}, met als concreet voorbeeld {{achievement}}.` : `The ${roleTitle} opportunity at {{company_name}} appeals to me because of {{organization_motivation}}. My relevant foundation is {{experience_summary}}, supported by this concrete example: {{achievement}}.`),
        p(nl ? 'Mijn aansluiting op de functie ligt in {{competency}}. {{call_to_action}}' : 'My fit for the role centers on {{competency}}. {{call_to_action}}'),
        p(nl ? 'Met vriendelijke groet,\n{{candidate_name}}' : 'Kind regards,\n{{candidate_name}}'),
      ], index > 0);
    }),
  });
}

function messageToolkit(language) {
  const nl = language === 'nl';
  return documentTemplate({
    id: `application-messages-${language}`,
    language,
    title: nl ? 'Sollicitatieberichten' : 'Job Application Messages',
    filename: `${language}-application-messages.docx`,
    role: 'message',
    sections: [
      section('cover-email', nl ? 'Korte begeleidende e-mail' : 'Short cover email', [p(nl ? 'Onderwerp: Sollicitatie {{job_title}} — {{candidate_name}}' : 'Subject: Application for {{job_title}} — {{candidate_name}}'), p(nl ? 'Beste {{contact_person}},\nIn de bijlage vindt u mijn sollicitatie voor {{job_title}}. Mijn ervaring met {{experience_summary}} sluit aan op de rol. Graag licht ik mijn motivatie toe.\nMet vriendelijke groet,\n{{candidate_name}}' : 'Dear {{contact_person}},\nPlease find attached my application for {{job_title}}. My experience in {{experience_summary}} aligns with the role, and I would welcome a conversation.\nKind regards,\n{{candidate_name}}')]),
      section('follow-up', nl ? 'Follow-upbericht' : 'Follow-up message', [p(nl ? 'Beste {{contact_person}},\nOp {{date}} solliciteerde ik naar {{job_title}}. Ik hoor graag of ik aanvullende informatie kan geven.\nMet vriendelijke groet,\n{{candidate_name}}' : 'Dear {{contact_person}},\nI applied for {{job_title}} on {{date}}. Please let me know if any additional information would be helpful.\nKind regards,\n{{candidate_name}}')]),
      section('thank-you', nl ? 'Bedankbericht na gesprek' : 'Post-interview thank-you', [p(nl ? 'Beste {{contact_person}},\nDank voor het gesprek over {{job_title}}. Het onderdeel {{organization_motivation}} bevestigde mijn interesse. Ik hoor graag over het vervolg.\nMet vriendelijke groet,\n{{candidate_name}}' : 'Dear {{contact_person}},\nThank you for discussing {{job_title}} with me. Learning more about {{organization_motivation}} reinforced my interest. I look forward to hearing about next steps.\nKind regards,\n{{candidate_name}}')]),
    ],
  });
}

function overviewTemplate(language, type) {
  const nl = language === 'nl';
  const definitions = {
    references: [nl ? 'Referentielijst' : 'Reference List', nl ? ['Naam', 'Relatie en contact'] : ['Name', 'Relationship and contact'], [['{{references}}', '{{email}} | {{phone}}']]],
    projects: [nl ? 'Projectoverzicht' : 'Project Portfolio', nl ? ['Project', 'Rol, aanpak en resultaat'] : ['Project', 'Role, approach, and outcome'], [['{{project}}', '{{experience_summary}} — {{achievement}}']]],
    competencies: [nl ? 'Competentie- en certificatenoverzicht' : 'Competency and Certification Overview', nl ? ['Onderdeel', 'Bewijs'] : ['Area', 'Evidence'], [['{{competency}}', '{{evidence}}'], ['{{certificate}}', '{{education}}'], ['{{software}}', '{{achievement}}']]],
    interview: [nl ? 'Interview- en onderhandelingsvoorbereiding' : 'Interview and Negotiation Preparation', nl ? ['Onderwerp', 'Voorbereiding'] : ['Topic', 'Preparation'], [[nl ? 'Elevator pitch' : 'Elevator pitch', '{{professional_profile}}'], [nl ? 'Kernvoorbeeld' : 'Core example', '{{achievement}}'], [nl ? 'Salarisdoel' : 'Salary target', '{{salary_target}} — {{evidence}}'], [nl ? 'Vragen' : 'Questions', '{{organization_motivation}}']]],
  };
  const [title, columns, rows] = definitions[type];
  return documentTemplate({
    id: `${type}-overview-${language}`,
    language,
    title,
    filename: `${language}-${type}-overview.docx`,
    role: type === 'interview' ? 'worksheet' : 'reference',
    sections: [section('guide', nl ? 'Invulinstructie' : 'Completion guide', [p(nl ? 'Vervang placeholders uitsluitend door gecontroleerde eigen informatie.' : 'Replace placeholders only with verified personal information.', 'note')]), section('content', title, [table(columns, rows, [3000, 6360])])],
  });
}

function sharedConfiguration(id, version, title, hasWorkbook) {
  return freeze({
    schemaVersion: V, productId: id, productVersion: version, locale: 'nl-NL', market: 'NL', currency: 'EUR', year: 2026,
    themeId: 'modern-minimal', title, filename: `${id}.${hasWorkbook ? 'xlsx' : 'docx'}`, inputCapacity: 100, sampleDataEnabled: true,
    categoryOverrides: list([]), featureFlags: freeze({ documentTemplates: true, careerTools: true, combinedWorkbook: hasWorkbook }), branding: freeze({ enabled: false }),
    outputOptions: freeze({ workbook: hasWorkbook, documents: true, package: true, customerDocs: true, listing: true, imageManifests: false }),
    extensions: freeze({ productAppearance: 'light', paletteId: 'modern-minimal' }),
  });
}

const CONFIG_FIELDS = list([
  freeze({ id: 'locale', type: 'enum', labelKey: 'ui.label.locale', configurationPath: 'locale', defaultValue: 'nl-NL', choices: LOCALES, required: true }),
  freeze({ id: 'currency', type: 'enum', labelKey: 'ui.label.currency', configurationPath: 'currency', defaultValue: 'EUR', choices: CURRENCIES, required: true }),
  freeze({ id: 'theme-id', type: 'enum', labelKey: 'ui.label.theme', configurationPath: 'themeId', defaultValue: 'modern-minimal', choices: THEMES, required: true }),
  freeze({ id: 'title', type: 'string', labelKey: 'ui.label.title', configurationPath: 'title', defaultValue: 'Career Template Pack', required: true }),
  freeze({ id: 'filename', type: 'string', labelKey: 'ui.label.filename', configurationPath: 'filename', defaultValue: 'career-template.docx', required: true }),
]);

const QUALITY = list([
  freeze({ id: 'technical-integrity', metric: 'technical-integrity', weight: 0.25, threshold: 100, severity: 'blocker' }),
  freeze({ id: 'content-quality', metric: 'content-quality', weight: 0.20, threshold: 90, severity: 'error' }),
  freeze({ id: 'usability', metric: 'usability', weight: 0.15, threshold: 90, severity: 'error' }),
  freeze({ id: 'localization', metric: 'localization', weight: 0.15, threshold: 100, severity: 'blocker' }),
  freeze({ id: 'commercial-completeness', metric: 'commercial-completeness', weight: 0.10, threshold: 90, severity: 'error' }),
  freeze({ id: 'accessibility', metric: 'accessibility', weight: 0.10, threshold: 90, severity: 'warning' }),
  freeze({ id: 'export-completeness', metric: 'export-completeness', weight: 0.05, threshold: 100, severity: 'blocker' }),
]);

const IMAGE_SPEC = list([freeze({ id: 'document-preview', purpose: 'thumbnail', width: 2400, height: 1600, format: 'png', required: true })]);

function commercial(nameKey, descriptionKey, keywords) {
  return freeze({
    schemaVersion: V, titleKey: nameKey, descriptionKey, category: 'Career & Job Application Templates', targetAudience: list(['job-seekers', 'career-changers', 'professionals']),
    keywords: list(keywords), marketplaces: list(['etsy', 'direct']), licenseKey: 'commercial.personalLicense', disclaimerKeys: list([]),
    listingAttributes: freeze({ productType: 'digital-download', includesDocuments: true, externalPublication: false, pdfIncluded: false }),
  });
}

function careerDefinition({ id, title, nameKey, descriptionKey, features, tags, templates, sheets = [] }) {
  const hasWorkbook = sheets.length > 0;
  const version = '0.9.0';
  const frozenSheets = list(sheets);
  return freeze({
    schemaVersion: V, id, version, status: 'beta', productFamily: 'career-job-application', category: 'career-templates', nameKey, descriptionKey,
    saleType: 'bundle', difficulty: 'beginner', tags: list(tags), recommended: true, features: list(features), outputTypes: list(hasWorkbook ? ['xlsx', 'docx', 'zip'] : ['docx', 'zip']),
    supportedLocales: LOCALES, supportedCurrencies: CURRENCIES, supportedThemes: THEMES, defaultConfiguration: sharedConfiguration(id, version, title, hasWorkbook), configurableFields: CONFIG_FIELDS,
    ...(hasWorkbook ? { sheets: frozenSheets, formulas: list(frozenSheets.flatMap(item => item.formulas)), validations: list(frozenSheets.flatMap(item => item.validations)) } : {}),
    documentTemplates: list(templates), qualityRules: QUALITY, commercialMetadata: commercial(nameKey, descriptionKey, tags), imageSpecifications: IMAGE_SPEC,
    compatibility: freeze({ targets: list(hasWorkbook ? ['excel-desktop', 'docx-ooxml'] : ['docx-ooxml']), minimumExcelVersion: hasWorkbook ? '2019' : null, requiresFormulaRecalculation: false, googleSheetsSupported: false, limitations: list(['DOCX is generated and structurally validated locally.', 'PDF export is not implemented.', 'Google Docs is supported only as manual DOCX import compatibility.']) }),
    exportProfile: freeze({ ...(hasWorkbook ? { workbookFilenameTemplate: '{productId}_{locale}_{version}.xlsx' } : {}), packageFilenameTemplate: '{productId}_{locale}_{version}.zip', include: list([...(hasWorkbook ? ['workbook'] : []), 'documents', 'readme', 'license', 'manifest', 'listing', 'reports']) }),
    generatorId: hasWorkbook ? 'integrated-artifact-v1' : 'integrated-document-v1',
    extensions: freeze({ defaultVisible: false, approvalRequired: true, releaseCandidate: true, beta: true, pdfExport: 'NOT_IMPLEMENTED', googleDocsExport: 'NOT_IMPLEMENTED', supportedAppearances: list(['light', 'dark']) }),
  });
}

const cvTemplates = list(['nl', 'en'].flatMap(language => CV_VARIANTS.map(variant => cvTemplate(language, variant))));
const letterTemplates = list(['nl', 'en'].flatMap(language => [...LETTER_FORMS.map(form => letterTemplate(language, form)), roleDirectionTemplate(language)]));

const col = (id, labelKey, type = 'string', width = 20) => freeze({ schemaVersion: V, id, labelKey, type, width, role: 'input', format: type === 'date' ? 'locale-date' : type === 'currency' ? 'currency' : type === 'integer' ? 'integer' : 'text', validationId: null, required: false, locked: false });
const calculatedCol = (id, labelKey, type = 'currency', width = 20) => freeze({ schemaVersion: V, id, labelKey, type, width, role: 'calculated', format: type === 'currency' ? 'currency' : 'integer', validationId: null, required: false, locked: true });
const print = freeze({ orientation: 'landscape', paperSize: 'A4', fitToWidth: 1, fitToHeight: 0 });
const workbookSheet = (id, nameKey, order, columns, sampleRows = [], formulas = []) => freeze({ schemaVersion: V, id, nameKey, type: 'input', order, hidden: false, columns: list(columns), inputRows: 100, freeze: freeze({ rows: 1, columns: 0 }), autoFilter: true, print, formulas: list(formulas), validations: list([]), sampleRows: list(sampleRows.map(row => freeze(row))), styleRole: 'table', extensions: freeze({ capacityMode: 'CONFIGURATION_INPUT_CAPACITY' }) });

const applicationSheets = list([
  workbookSheet('application-tracker', 'sheets.applicationTracker', 1, [col('company', 'columns.company', 'string', 24), col('role', 'columns.role', 'string', 24), col('applied-date', 'columns.appliedDate', 'date', 16), col('source', 'columns.source', 'string', 20), col('status', 'columns.status', 'string', 18), col('next-action', 'columns.nextAction', 'string', 32)], [{ company: '{{company_name}}', role: '{{job_title}}', source: '{{vacancy_source}}', status: '{{status}}', 'next-action': '{{next_action}}' }]),
  workbookSheet('vacancy-analysis', 'sheets.vacancyAnalysis', 2, [col('requirement', 'columns.requirement', 'string', 32), col('evidence', 'columns.evidence', 'string', 38), col('gap', 'columns.gap', 'string', 28), col('action', 'columns.action', 'string', 30)], [{ requirement: '{{vacancy_requirement}}', evidence: '{{verified_evidence}}', gap: '{{gap}}', action: '{{action}}' }]),
  workbookSheet('interview-preparation', 'sheets.interviewPreparation', 3, [col('question', 'columns.question', 'string', 38), col('answer', 'columns.answer', 'string', 44), col('evidence', 'columns.evidence', 'string', 32)], [{ question: '{{interview_question}}', answer: '{{answer_outline}}', evidence: '{{verified_evidence}}' }]),
  workbookSheet('star-examples', 'sheets.starExamples', 4, [col('situation', 'columns.situation', 'string', 30), col('task', 'columns.task', 'string', 28), col('action', 'columns.action', 'string', 34), col('result', 'columns.result', 'string', 30)], [{ situation: '{{situation}}', task: '{{task}}', action: '{{action}}', result: '{{verified_result}}' }]),
  workbookSheet('salary-preparation', 'sheets.salaryPreparation', 5, [col('item', 'columns.item', 'string', 28), col('minimum-salary', 'columns.minimumSalary', 'currency', 18), col('target-salary', 'columns.targetSalary', 'currency', 18), calculatedCol('salary-range', 'columns.salaryRange', 'currency', 18), col('evidence', 'columns.evidence', 'string', 40), col('note', 'columns.note', 'string', 34)], [{ item: '{{salary_component}}', evidence: '{{market_or_personal_evidence}}', note: '{{note}}' }], [freeze({ schemaVersion: V, id: 'salary-range', sheetId: 'salary-preparation', target: 'salary-range', operation: 'ROW_DIFFERENCE', parameters: freeze({ leftColumnId: 'target-salary', rightColumnId: 'minimum-salary' }), fillDirection: 'down', inputRowsBound: true, extensions: freeze({ purpose: 'negotiation-range' }) })]),
  workbookSheet('application-checklist', 'sheets.applicationChecklist', 6, [col('task', 'columns.task', 'string', 38), col('status', 'columns.status', 'string', 18), col('deadline', 'columns.deadline', 'date', 16), col('note', 'columns.note', 'string', 40)], [{ task: '{{application_task}}', status: '{{status}}', note: '{{note}}' }]),
  workbookSheet('instructions', 'sheets.instructions', 7, [col('step', 'columns.step', 'integer', 10), col('description', 'columns.description', 'string', 70)], [{ step: 1, description: 'Replace all placeholders with verified information.' }, { step: 2, description: 'Review every claim, date, file, and recipient before sending.' }]),
]);

function combinedTemplates() {
  return list(['nl', 'en'].flatMap(language => {
    const ats = structuredClone(cvTemplate(language, CV_VARIANTS[0]));
    ats.id = `complete-pack-ats-cv-${language}`;
    ats.filename = `${language}-complete-pack-ats-cv.docx`;
    ats.packaging.relativePath = `${language}/${ats.filename}`;
    const professional = structuredClone(cvTemplate(language, CV_VARIANTS[1]));
    professional.id = `complete-pack-professional-cv-${language}`;
    professional.filename = `${language}-complete-pack-professional-cv.docx`;
    professional.packaging.relativePath = `${language}/${professional.filename}`;
    const letter = structuredClone(letterTemplate(language, LETTER_FORMS[0]));
    letter.id = `complete-pack-motivation-letter-${language}`;
    letter.filename = `${language}-complete-pack-motivation-letter.docx`;
    letter.packaging.relativePath = `${language}/${letter.filename}`;
    return [ats, professional, letter, messageToolkit(language), overviewTemplate(language, 'references'), overviewTemplate(language, 'projects'), overviewTemplate(language, 'competencies'), overviewTemplate(language, 'interview')].map(item => freeze(item));
  }));
}

export const professionalCvTemplatePack = careerDefinition({
  id: 'professional-cv-template-pack', title: 'Professional CV Template Pack', nameKey: 'products.professionalCvTemplatePack.name', descriptionKey: 'products.professionalCvTemplatePack.description',
  features: ['ats-friendly-cv', 'professional-cv', 'executive-cv', 'role-specific-cv', 'editable-docx', 'user-guide'],
  tags: ['cv-template', 'resume-template', 'ats-friendly', 'job-application', 'career'], templates: cvTemplates,
});

export const motivationLetterTemplatePack = careerDefinition({
  id: 'motivation-letter-template-pack', title: 'Motivation Letter Template Pack', nameKey: 'products.motivationLetterTemplatePack.name', descriptionKey: 'products.motivationLetterTemplatePack.description',
  features: ['motivation-letter', 'cover-letter', 'role-specific-letters', 'career-change', 'editable-docx', 'user-guide'],
  tags: ['motivation-letter', 'cover-letter', 'job-application', 'career-change', 'letter-template'], templates: letterTemplates,
});

export const completeJobApplicationPack = careerDefinition({
  id: 'complete-job-application-pack', title: 'Complete Job Application Pack', nameKey: 'products.completeJobApplicationPack.name', descriptionKey: 'products.completeJobApplicationPack.description',
  features: ['ats-friendly-cv', 'professional-cv', 'motivation-letter', 'application-messages', 'application-tracker', 'vacancy-analysis', 'interview-preparation', 'star-method', 'salary-preparation', 'application-checklist', 'user-guide'],
  tags: ['job-application', 'cv-template', 'cover-letter', 'application-tracker', 'interview-prep'], templates: combinedTemplates(), sheets: applicationSheets,
});

export const careerProductDefinitions = list([professionalCvTemplatePack, motivationLetterTemplatePack, completeJobApplicationPack]);
export default careerProductDefinitions;
