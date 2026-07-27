const LANGUAGE_NAMES = Object.freeze({ en: 'English', es: 'Español', de: 'Deutsch', fr: 'Français', nl: 'Nederlands' });
const SCENE_IDS = Object.freeze(['introduction', 'new-run', 'product-selection', 'market-audience', 'locale-currency-year', 'configuration', 'categories', 'appearance', 'preview', 'validation', 'generation', 'workbook', 'physical-images', 'packages', 'closing']);

export function normalizeLocale(value) {
  return String(value ?? '').trim().replaceAll('_', '-').toLowerCase();
}

export function resolveTutorialLanguage(productLocale) {
  const locale = normalizeLocale(productLocale);
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('de')) return 'de';
  if (locale.startsWith('fr')) return 'fr';
  if (locale.startsWith('nl')) return 'nl';
  return 'en';
}

const TITLES = Object.freeze({
  en: ['Introduction', 'Start a new production run', 'Select the budget planner', 'Set market and audience', 'Set language, currency and year', 'Configure the product', 'Review automatic categories', 'Choose theme and workbook appearance', 'Generate the preview', 'Pass all validation gates', 'Generate the product', 'Inspect the real Excel workbook', 'Inspect the ten physical Photoshop images', 'Review the customer package and sales set', 'Complete the release'],
  nl: ['Introductie', 'Start een nieuwe productieronde', 'Selecteer de budgetplanner', 'Stel markt en doelgroep in', 'Stel taal, valuta en jaar in', 'Configureer het product', 'Controleer automatische categorieën', 'Kies thema en werkmapweergave', 'Genereer de preview', 'Doorloop alle validatiegates', 'Genereer het product', 'Inspecteer de echte Excel-werkmap', 'Inspecteer de tien fysieke Photoshop-afbeeldingen', 'Controleer klantpakket en sales-set', 'Voltooi de release'],
  de: ['Einführung', 'Neue Produktionsrunde starten', 'Budgetplaner auswählen', 'Markt und Zielgruppe festlegen', 'Sprache, Währung und Jahr festlegen', 'Produkt konfigurieren', 'Automatische Kategorien prüfen', 'Theme und Workbook-Darstellung wählen', 'Vorschau generieren', 'Alle Validierungsprüfungen bestehen', 'Produkt generieren', 'Echte Excel-Arbeitsmappe prüfen', 'Zehn physische Photoshop-Bilder prüfen', 'Kundenpaket und Sales-Set prüfen', 'Release abschließen'],
  fr: ['Introduction', 'Démarrer une nouvelle production', 'Sélectionner le planificateur budgétaire', 'Définir le marché et le public', 'Définir la langue, la devise et l’année', 'Configurer le produit', 'Vérifier les catégories automatiques', 'Choisir le thème et l’apparence du classeur', 'Générer l’aperçu', 'Valider les six contrôles', 'Générer le produit', 'Inspecter le véritable classeur Excel', 'Inspecter les dix images Photoshop physiques', 'Vérifier le package client et le kit commercial', 'Terminer la livraison'],
  es: ['Introducción', 'Iniciar una nueva producción', 'Seleccionar el planificador de presupuesto', 'Configurar el mercado y el público', 'Configurar idioma, moneda y año', 'Configurar el producto', 'Revisar las categorías automáticas', 'Elegir el tema y la apariencia del libro', 'Generar la vista previa', 'Superar las seis validaciones', 'Generar el producto', 'Inspeccionar el libro de Excel real', 'Inspeccionar las diez imágenes físicas de Photoshop', 'Revisar el paquete del cliente y el conjunto de ventas', 'Finalizar la entrega'],
});

const NARRATION = Object.freeze({
  en: [
    'Welcome to Finance Product Factory. This tutorial follows one complete, production-ready budget planner from configuration to validated delivery.',
    'The dashboard opens a fresh local production run. All product data stays in the project and the progress indicator shows which stage is active.',
    'In Product catalogue, select Budget Planner Ultimate. The product card also defines the tier, so workbook features, sales copy and package contents remain consistent.',
    'Open Market and audience. Select the target market and describe the customer clearly, so commercial copy and positioning are generated from the same source.',
    'In Product language and currency, choose the locale and currency, then set the production year. These choices control labels, number formats and localized output.',
    'Review the product configuration and naming. Required fields, version information and feature choices are validated before generation can continue.',
    'The Categories step loads the product defaults automatically. Review income and expense categories and adjust only the optional entries needed for this audience.',
    'Choose a workbook theme and select the light or dark workbook appearance. The preview, charts, workbook cells and sales images use this same visual configuration.',
    'Generate the preview and inspect the dashboard, tables and charts. This is the last visual review before the validation and build stages.',
    'Run validation. All six gates must pass: configuration, localization, workbook structure, formulas, commercial package and release readiness.',
    'Generate the product. Finance Product Factory creates and rereads the XLSX, produces the listing assets and assembles the customer download without manual editing.',
    'Open the physical Excel workbook. The dashboard, input sheets, categories and charts are real workbook content and remain editable in Microsoft Excel.',
    'Next, inspect all ten physical PNG product images exported through the Photoshop template pipeline. Each image is decoded at the required dimensions before release.',
    'Finally, review the customer ZIP and the master sales set. Customer packages contain only deliverables, while technical validation evidence remains internal.',
    'The workbook, Photoshop images, customer package and sales assets are now ready for the final release gate. The workflow is complete and reproducible.',
  ],
  nl: [
    'Welkom bij Finance Product Factory. In deze tutorial volgen we één complete, productieklare budgetplanner van configuratie tot gevalideerde levering.',
    'Het dashboard opent een nieuwe lokale productieronde. Alle productdata blijft binnen het project en de voortgangsindicator toont welke fase actief is.',
    'Selecteer Budget Planner Ultimate in de Productcatalogus. De productkaart bepaalt ook de tier, zodat werkmapfuncties, verkooptekst en pakketinhoud consistent blijven.',
    'Open Markt en doelgroep. Kies de doelmarkt en beschrijf de klant duidelijk, zodat commerciële teksten en positionering uit dezelfde bron worden opgebouwd.',
    'Kies bij Producttaal en valuta de locale en valuta en stel daarna het productiejaar in. Deze keuzes bepalen labels, getalnotatie en gelokaliseerde uitvoer.',
    'Controleer de productconfiguratie en naamgeving. Verplichte velden, versiegegevens en functiekeuzes worden gevalideerd voordat de generatie kan doorgaan.',
    'De stap Categorieën laadt automatisch de standaardcategorieën van het product. Controleer inkomsten en uitgaven en pas alleen benodigde optionele regels aan.',
    'Kies een werkmapthema en selecteer de lichte of donkere werkmapweergave. Preview, grafieken, cellen en verkoopafbeeldingen gebruiken dezelfde visuele configuratie.',
    'Genereer de preview en inspecteer dashboard, tabellen en grafieken. Dit is de laatste visuele controle vóór validatie en productbouw.',
    'Voer de validatie uit. Alle zes gates moeten slagen: configuratie, lokalisatie, werkmapstructuur, formules, commercieel pakket en releasegereedheid.',
    'Genereer het product. Finance Product Factory maakt en herleest de XLSX, bouwt de listingassets en stelt de klantdownload samen zonder handmatige nabewerking.',
    'Open de fysieke Excel-werkmap. Dashboard, invoersheets, categorieën en grafieken zijn echte werkmapinhoud en blijven bewerkbaar in Microsoft Excel.',
    'Inspecteer vervolgens alle tien fysieke PNG-productafbeeldingen uit de Photoshop-templatepipeline. Iedere afbeelding wordt vóór release op formaat en decodeerbaarheid gecontroleerd.',
    'Controleer ten slotte de klant-ZIP en de master sales-set. Klantpakketten bevatten alleen leverbare bestanden; technische validatiebewijzen blijven intern.',
    'De werkmap, Photoshop-afbeeldingen, het klantpakket en de verkoopassets zijn gereed voor de definitieve releasegate. De workflow is compleet en reproduceerbaar.',
  ],
  de: [
    'Willkommen bei Finance Product Factory. In diesem Tutorial begleiten wir einen vollständigen, produktionsreifen Budgetplaner von der Konfiguration bis zur validierten Auslieferung.',
    'Das Dashboard öffnet eine neue lokale Produktionsrunde. Alle Produktdaten bleiben im Projekt und die Fortschrittsanzeige zeigt die aktive Phase.',
    'Wählen Sie im Produktkatalog Budget Planner Ultimate. Die Produktkarte legt zugleich das Tier fest, damit Workbook-Funktionen, Verkaufstexte und Paketinhalte konsistent bleiben.',
    'Öffnen Sie Markt und Zielgruppe. Wählen Sie den Zielmarkt und beschreiben Sie den Kunden eindeutig, damit Positionierung und Verkaufstexte aus derselben Quelle entstehen.',
    'Wählen Sie unter Produktsprache und Währung die Locale und Währung und legen Sie danach das Produktionsjahr fest. Diese Auswahl steuert Beschriftungen, Zahlenformate und lokalisierte Ausgaben.',
    'Prüfen Sie Produktkonfiguration und Benennung. Pflichtfelder, Versionsdaten und Funktionsauswahl werden validiert, bevor die Generierung fortgesetzt wird.',
    'Der Schritt Kategorien lädt automatisch die Produktvorgaben. Prüfen Sie Einnahmen und Ausgaben und ändern Sie nur die optionalen Einträge, die diese Zielgruppe benötigt.',
    'Wählen Sie ein Workbook-Theme sowie die helle oder dunkle Darstellung. Vorschau, Diagramme, Zellen und Verkaufsbilder verwenden dieselbe visuelle Konfiguration.',
    'Generieren Sie die Vorschau und prüfen Sie Dashboard, Tabellen und Diagramme. Dies ist die letzte visuelle Kontrolle vor Validierung und Build.',
    'Starten Sie die Validierung. Alle sechs Prüfungen müssen bestehen: Konfiguration, Lokalisierung, Workbook-Struktur, Formeln, Kundenpaket und Release-Bereitschaft.',
    'Generieren Sie das Produkt. Finance Product Factory erstellt und liest die XLSX erneut, erzeugt Listing-Assets und baut den Kundendownload ohne manuelle Nacharbeit.',
    'Öffnen Sie die physische Excel-Arbeitsmappe. Dashboard, Eingabeblätter, Kategorien und Diagramme sind echte Workbook-Inhalte und bleiben in Microsoft Excel editierbar.',
    'Prüfen Sie anschließend alle zehn physischen PNG-Produktbilder aus der Photoshop-Template-Pipeline. Jedes Bild wird vor dem Release decodiert und auf seine Abmessungen geprüft.',
    'Prüfen Sie zuletzt Kunden-ZIP und Master-Sales-Set. Kundenpakete enthalten nur auslieferbare Dateien; technische Validierungsnachweise bleiben intern.',
    'Workbook, Photoshop-Bilder, Kundenpaket und Verkaufsassets sind nun für das finale Release-Gate bereit. Der Ablauf ist vollständig und reproduzierbar.',
  ],
  fr: [
    'Bienvenue dans Finance Product Factory. Ce tutoriel suit un planificateur budgétaire complet et prêt pour la production, de sa configuration à sa livraison validée.',
    'Le tableau de bord ouvre une nouvelle production locale. Toutes les données restent dans le projet et l’indicateur de progression affiche l’étape active.',
    'Dans le catalogue, sélectionnez Budget Planner Ultimate. La carte définit aussi le niveau, afin de garder cohérents les fonctions, les textes commerciaux et le contenu du package.',
    'Ouvrez Marché et public. Choisissez le marché cible et décrivez précisément le client pour générer le positionnement et les textes depuis une source unique.',
    'Dans Langue du produit et devise, choisissez la locale et la devise, puis définissez l’année. Ces choix pilotent les libellés, les formats numériques et les livrables localisés.',
    'Vérifiez la configuration et le nom du produit. Les champs obligatoires, la version et les options sont validés avant de poursuivre la génération.',
    'L’étape Catégories charge automatiquement les valeurs du produit. Vérifiez revenus et dépenses, puis adaptez uniquement les éléments facultatifs utiles au public.',
    'Choisissez un thème et l’apparence claire ou sombre du classeur. L’aperçu, les graphiques, les cellules et les images commerciales utilisent la même configuration.',
    'Générez l’aperçu et contrôlez le tableau de bord, les tableaux et les graphiques. Il s’agit de la dernière vérification visuelle avant validation.',
    'Lancez la validation. Les six contrôles doivent réussir : configuration, localisation, structure Excel, formules, package commercial et préparation de la livraison.',
    'Générez le produit. Finance Product Factory crée puis relit le XLSX, produit les ressources de vente et assemble le téléchargement client sans retouche manuelle.',
    'Ouvrez le véritable classeur Excel. Le tableau de bord, les feuilles de saisie, les catégories et les graphiques restent des contenus modifiables dans Microsoft Excel.',
    'Inspectez ensuite les dix images PNG physiques exportées par la pipeline Photoshop. Chaque image est décodée et contrôlée aux dimensions requises avant livraison.',
    'Vérifiez enfin le ZIP client et le kit commercial principal. Les packages clients ne contiennent que les livrables, tandis que les preuves techniques restent internes.',
    'Le classeur, les images Photoshop, le package client et les ressources commerciales sont prêts pour la validation finale. Le processus est complet et reproductible.',
  ],
  es: [
    'Bienvenido a Finance Product Factory. Este tutorial sigue un planificador de presupuesto completo y listo para producción, desde la configuración hasta la entrega validada.',
    'El panel abre una nueva producción local. Todos los datos permanecen dentro del proyecto y el indicador de progreso muestra la fase activa.',
    'En el catálogo, selecciona Budget Planner Ultimate. La tarjeta también define el nivel para mantener coherentes las funciones, el texto comercial y el contenido del paquete.',
    'Abre Mercado y público. Elige el mercado objetivo y describe claramente al cliente para generar el posicionamiento y los textos desde una única fuente.',
    'En Idioma del producto y moneda, selecciona la configuración regional y la moneda y define el año. Estas opciones controlan etiquetas, formatos numéricos y archivos localizados.',
    'Revisa la configuración y el nombre del producto. Los campos obligatorios, la versión y las funciones se validan antes de continuar con la generación.',
    'La sección Categorías carga automáticamente los valores del producto. Revisa ingresos y gastos y modifica solo las entradas opcionales que necesite este público.',
    'Elige un tema y la apariencia clara u oscura del libro. La vista previa, los gráficos, las celdas y las imágenes de venta usan la misma configuración visual.',
    'Genera la vista previa y revisa el panel, las tablas y los gráficos. Esta es la última comprobación visual antes de validar y construir el producto.',
    'Ejecuta la validación. Deben aprobarse las seis puertas: configuración, localización, estructura del libro, fórmulas, paquete comercial y preparación para entrega.',
    'Genera el producto. Finance Product Factory crea y vuelve a leer el XLSX, produce los recursos de venta y monta la descarga del cliente sin edición manual.',
    'Abre el libro de Excel físico. El panel, las hojas de entrada, las categorías y los gráficos son contenido real y siguen siendo editables en Microsoft Excel.',
    'Después, inspecciona las diez imágenes PNG físicas exportadas por la plantilla de Photoshop. Cada imagen se decodifica y se valida en las dimensiones requeridas.',
    'Por último, revisa el ZIP del cliente y el conjunto maestro de ventas. Los paquetes de cliente contienen solo entregables y las pruebas técnicas permanecen internas.',
    'El libro, las imágenes de Photoshop, el paquete del cliente y los recursos de venta están listos para la validación final. El proceso es completo y reproducible.',
  ],
});

const COPY = Object.freeze({
  en: { title: 'Finance Product Factory — complete product tutorial', description: 'Create, validate and package a real financial workbook with Excel evidence, physical Photoshop images and release-ready sales assets.', tags: ['finance product factory', 'Excel tutorial', 'budget planner', 'digital product', 'workbook automation'] },
  nl: { title: 'Finance Product Factory — volledige producttutorial', description: 'Maak, valideer en verpak een echte financiële werkmap met Excel-bewijs, fysieke Photoshop-afbeeldingen en releaseklare verkoopassets.', tags: ['finance product factory', 'Excel tutorial', 'budgetplanner', 'digitaal product', 'werkmap automatisering'] },
  de: { title: 'Finance Product Factory — vollständiges Produkttutorial', description: 'Erstellen, validieren und verpacken Sie eine echte Finanz-Arbeitsmappe mit Excel-Nachweisen, physischen Photoshop-Bildern und releasefertigen Verkaufsassets.', tags: ['finance product factory', 'Excel Tutorial', 'Budgetplaner', 'digitales Produkt', 'Workbook Automatisierung'] },
  fr: { title: 'Finance Product Factory — tutoriel produit complet', description: 'Créez, validez et préparez un véritable classeur financier avec preuves Excel, images Photoshop physiques et ressources commerciales prêtes à livrer.', tags: ['finance product factory', 'tutoriel Excel', 'planificateur budget', 'produit numérique', 'automatisation Excel'] },
  es: { title: 'Finance Product Factory — tutorial completo del producto', description: 'Crea, valida y empaqueta un libro financiero real con pruebas de Excel, imágenes físicas de Photoshop y recursos de venta listos para publicar.', tags: ['finance product factory', 'tutorial Excel', 'planificador presupuesto', 'producto digital', 'automatización Excel'] },
});

function clock(seconds, separator = '.') {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const whole = Math.floor(value % 60);
  const millis = Math.floor((value - Math.floor(value)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
}

export function buildSubtitleFiles(scenes) {
  const cues = scenes.map((scene, index) => ({ ...scene, index: index + 1 }));
  const vtt = ['WEBVTT', '', ...cues.flatMap(cue => [String(cue.index), `${clock(cue.start)} --> ${clock(cue.end)}`, cue.narration, ''])].join('\n');
  const srt = cues.flatMap(cue => [String(cue.index), `${clock(cue.start, ',')} --> ${clock(cue.end, ',')}`, cue.narration, '']).join('\n');
  return Object.freeze({ srt: `${srt.trim()}\n`, vtt: `${vtt.trim()}\n` });
}

export function buildTutorialContent(productLocale) {
  const requestedLocale = String(productLocale ?? '');
  const language = resolveTutorialLanguage(requestedLocale);
  const copy = COPY[language];
  const scenes = SCENE_IDS.map((id, index) => Object.freeze({ id, index: index + 1, title: TITLES[language][index], narration: NARRATION[language][index], start: index * 10, end: (index + 1) * 10 }));
  const subtitles = buildSubtitleFiles(scenes);
  const narration = scenes.map(scene => scene.narration).join(' ');
  const chapters = scenes.map(scene => `${clock(scene.start).slice(3, 8)} ${scene.title}`);
  return Object.freeze({ schemaVersion: '2.0.0', requestedLocale, language, languageName: LANGUAGE_NAMES[language], title: copy.title, description: copy.description, tags: Object.freeze(copy.tags), scenes: Object.freeze(scenes), steps: Object.freeze(scenes), narration, subtitles: subtitles.vtt, srt: subtitles.srt, vtt: subtitles.vtt, chapters: Object.freeze(chapters) });
}
