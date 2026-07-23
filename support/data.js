(function () {
  "use strict";

  var common = Object.freeze({
    version: "1.0.0",
    platforms: Object.freeze(["Microsoft Excel Desktop 2019+"]),
    currencies: Object.freeze(["EUR", "USD", "GBP", "CAD", "AUD", "CHF"]),
    themes: Object.freeze(["Executive Navy", "Modern Minimal", "Warm Neutral", "Sage Finance", "Soft Pastel", "Lavender Balance"]),
    compatibility: Object.freeze({
      googleSheets: false,
      verified: "Microsoft Excel Desktop 2019 or later is the verified release target.",
      boundary: "Excel for web, LibreOffice and Google Sheets are not release-certified. Importing may recalculate formulas and simplify workbook styling."
    })
  });

  function locale(name, description, features, sheets) {
    return Object.freeze({
      name: name,
      description: description,
      features: Object.freeze(features),
      sheets: Object.freeze(sheets)
    });
  }

  function product(id, family, category, difficulty, appearances, nl, en, de) {
    return Object.freeze({
      id: id,
      version: common.version,
      family: family,
      category: category,
      difficulty: difficulty,
      appearances: Object.freeze(appearances),
      platforms: common.platforms,
      currencies: common.currencies,
      themes: common.themes,
      compatibility: common.compatibility,
      locales: Object.freeze({
        "nl-NL": nl,
        "en-US": en,
        "en-GB": en,
        "de-DE": de
      })
    });
  }

  var products = [
    product(
      "budget-planner-basic", "personal-budgeting", "budgeting", "beginner", ["light", "dark"],
      locale("Budgetplanner Basis", "Volg inkomsten, uitgaven, categorieën en maand- en jaartotalen.",
        ["Begrote en werkelijke uitgaven vergelijken", "Uitgaven per categorie analyseren", "Samenvatting van maandtotalen", "Samenvatting van jaartotalen"],
        ["Dashboard", "Inkomsten", "Uitgaven", "Categorieën", "Categorieanalyse", "Instructies"]),
      locale("Budget Planner Basic", "Track income, expenses, categories and monthly and annual totals.",
        ["Compare planned and actual spending", "Analyse spending by category", "Monthly total summary", "Annual total summary"],
        ["Dashboard", "Income", "Expenses", "Categories", "Category Analysis", "Instructions"]),
      locale("Budgetplaner Basis", "Einnahmen, Ausgaben, Kategorien sowie Monats- und Jahressummen verfolgen.",
        ["Geplante und tatsächliche Ausgaben vergleichen", "Ausgaben nach Kategorie analysieren", "Monats- und Jahressummen anzeigen"],
        ["Übersicht", "Einnahmen", "Ausgaben", "Kategorien", "Kategorieanalyse", "Anleitung"])
    ),
    product(
      "budget-planner-professional", "personal-budgeting", "budgeting", "intermediate", ["light", "dark"],
      locale("Budgetplanner Professional", "Een premium jaarbudgetsysteem met cashflow, rekeningen, doelen en categorieanalyse.",
        ["Professioneel financieel dashboard", "Jaaroverzicht", "Dynamisch model per maand", "Vaste en variabele uitgaven", "Rekeningen en betaalstatus", "Spaardoelen", "Categorieanalyse", "Budget versus werkelijk", "Cashflowanalyse", "Visuele grafieken", "Stapsgewijze instructies"],
        ["Dashboard", "Jaaroverzicht", "Inkomsten", "Vaste uitgaven", "Variabele uitgaven", "Rekeningen", "Doelen", "Cashflow", "Categorieanalyse", "Categorieën", "Instructies"]),
      locale("Budget Planner Professional", "A premium annual budget system with cashflow, bills, goals and category analytics.",
        ["Professional financial dashboard", "Year-at-a-glance overview", "Month-by-month model", "Fixed and variable expenses", "Bills and payment status", "Savings goals", "Category analytics", "Budget versus actual", "Cashflow analysis", "Visual charts", "Step-by-step instructions"],
        ["Dashboard", "Annual Overview", "Income", "Fixed Expenses", "Variable Expenses", "Bills", "Goals", "Cashflow", "Category Analysis", "Categories", "Instructions"]),
      locale("Budgetplaner Professional", "Ein hochwertiges Jahresbudgetsystem mit Cashflow, Rechnungen, Zielen und Kategorieanalyse.",
        ["Professionelles Finanzdashboard", "Jahresüberblick", "Monatsmodell", "Feste und variable Ausgaben", "Rechnungen", "Sparziele", "Kategorieanalyse", "Cashflow", "Diagramme", "Anleitung"],
        ["Übersicht", "Jahresübersicht", "Einnahmen", "Fixkosten", "Variable Kosten", "Rechnungen", "Ziele", "Cashflow", "Kategorieanalyse", "Kategorien", "Anleitung"])
    ),
    product(
      "budget-planner-ultimate", "personal-finance-os", "budgeting", "advanced", ["light", "dark"],
      locale("Budgetplanner Ultimate", "Een compleet persoonlijk financieel besturingssysteem voor budget, cashflow, sparen, schulden en nettovermogen.",
        ["Directie- en maanddashboards", "Cashflowdashboard", "Jaarbudget", "Betaalperiodeplanning", "Centraal transactieregister", "Terugkerende transacties en abonnementen", "Rekeningenkalender", "Reserverings- en noodfondsen", "Spaardoelen", "Sneeuwbal- en lawinemethode", "Bezittingen, verplichtingen en nettovermogen", "Trend-, categorie- en inkomstenanalyse", "Grafieken", "Werkmapconfiguratie"],
        ["Aan de slag", "Directieoverzicht", "Maandoverzicht", "Cashflowdashboard", "Trendanalyse", "Jaarbudget", "Betaalperiodeplan", "Transacties", "Terugkerende transacties", "Abonnementen", "Rekeningen", "Reserveringsfondsen", "Noodfonds", "Doelen", "Schulden", "Aflosplan", "Bezittingen", "Verplichtingenregister", "Vermogenshistorie", "Categorieanalyse", "Inkomstenanalyse", "Categorieën", "Configuratie", "Instructies"]),
      locale("Budget Planner Ultimate", "A complete personal finance operating system for budgeting, cashflow, savings, debt and net worth.",
        ["Executive and monthly dashboards", "Cashflow dashboard", "Annual budget", "Pay-period planning", "Central transaction register", "Recurring transactions and subscriptions", "Bill calendar", "Sinking and emergency funds", "Savings goals", "Debt snowball and avalanche", "Assets, liabilities and net worth", "Trend, category and income analysis", "Charts", "Workbook configuration"],
        ["Start Here", "Executive Overview", "Monthly Dashboard", "Cashflow Dashboard", "Trend Analysis", "Annual Budget", "Pay-Period Plan", "Transactions", "Recurring Transactions", "Subscriptions", "Bills", "Sinking Funds", "Emergency Fund", "Goals", "Debts", "Payment Plan", "Assets", "Liability Register", "Net-Worth History", "Category Analysis", "Income Analysis", "Categories", "Configuration", "Instructions"]),
      locale("Budgetplaner Ultimate", "Ein vollständiges persönliches Finanzsystem für Budget, Cashflow, Sparen, Schulden und Nettovermögen.",
        ["Management- und Monatsübersichten", "Cashflow-Übersicht", "Jahresbudget", "Zahlungsperioden", "Transaktionsregister", "Abonnements", "Rechnungen", "Rücklagen und Notfallfonds", "Ziele", "Schuldentilgungsstrategien", "Nettovermögen", "Trend- und Kategorieanalyse", "Diagramme", "Konfiguration"],
        ["Hier starten", "Jahressteuerung", "Monatsübersicht", "Cashflow-Übersicht", "Trendanalyse", "Jahresbudget", "Zahlungsperiodenplan", "Transaktionen", "Wiederkehrende Transaktionen", "Abonnements", "Rechnungen", "Rücklagenfonds", "Notfallfonds", "Ziele", "Schulden", "Tilgungsplan", "Vermögenswerte", "Verbindlichkeitenregister", "Vermögensverlauf", "Kategorieanalyse", "Einnahmenanalyse", "Kategorien", "Konfiguration", "Anleitung"])
    ),
    product(
      "monthly-budget-planner", "personal-budgeting", "budgeting", "beginner", ["light"],
      locale("Maandbudgetplanner", "Plan vaste en variabele kosten, sparen en resterend budget per maand.",
        ["Vaste en variabele kosten scheiden", "Ongebruikt budget doorschuiven", "Maandelijkse budgetstatus bekijken"],
        ["Dashboard", "Maandbudget", "Inkomsten", "Uitgaven", "Categorieën", "Instructies"]),
      locale("Monthly Budget Planner", "Plan fixed and variable costs, savings and remaining budget by month.",
        ["Separate fixed and variable costs", "Carry unused budget forward", "See monthly budget status"],
        ["Dashboard", "Monthly Budget", "Income", "Expenses", "Categories", "Instructions"]),
      locale("Monatsbudgetplaner", "Feste und variable Kosten, Sparen und Restbudget monatlich planen.",
        ["Fixe und variable Kosten trennen", "Ungenutztes Budget übertragen", "Monatlichen Budgetstatus anzeigen"],
        ["Übersicht", "Monatsbudget", "Einnahmen", "Ausgaben", "Kategorien", "Anleitung"])
    ),
    product(
      "debt-snowball-planner", "debt-repayment", "debt-management", "intermediate", ["light"],
      locale("Schulden-sneeuwbalplanner", "Prioriteer kleinere saldi en volg aflossing en rente.",
        ["Schulden op kleinste saldo prioriteren", "Aflosdatums voorspellen", "Rentepercentages en rentekosten volgen"],
        ["Dashboard", "Schulden", "Aflosplan", "Schuldtypen", "Instructies"]),
      locale("Debt Snowball Planner", "Prioritize smaller balances and track payoff progress and interest.",
        ["Prioritize debts by smallest balance", "Project debt payoff dates", "Track interest rates and costs"],
        ["Dashboard", "Debts", "Payment Plan", "Debt Types", "Instructions"]),
      locale("Schulden-Schneeballplaner", "Kleinere Salden priorisieren und Tilgung sowie Zinsen verfolgen.",
        ["Schulden nach kleinstem Saldo priorisieren", "Tilgungstermine prognostizieren", "Zinssätze und Kosten verfolgen"],
        ["Übersicht", "Schulden", "Tilgungsplan", "Schuldenarten", "Anleitung"])
    ),
    product(
      "savings-goal-tracker", "savings", "savings", "beginner", ["light"],
      locale("Spaardoeltracker", "Volg spaardoelen, bijdragen, voortgang en verwachte einddatum.",
        ["Meerdere spaardoelen volgen", "Iedere spaarinleg registreren", "Einddatums voorspellen"],
        ["Dashboard", "Doelen", "Bijdragen", "Categorieën", "Instructies"]),
      locale("Savings Goal Tracker", "Track savings targets, contributions, progress and projected completion.",
        ["Track multiple savings goals", "Log every savings contribution", "Project completion dates"],
        ["Dashboard", "Goals", "Contributions", "Categories", "Instructions"]),
      locale("Sparziel-Tracker", "Sparziele, Einzahlungen, Fortschritt und Endtermin verfolgen.",
        ["Mehrere Sparziele verfolgen", "Spareinzahlungen protokollieren", "Abschlusstermine prognostizieren"],
        ["Übersicht", "Ziele", "Einzahlungen", "Kategorien", "Anleitung"])
    ),
    product(
      "subscription-tracker", "recurring-expenses", "expense-management", "beginner", ["light"],
      locale("Abonnemententracker", "Bewaak terugkerende kosten, verlengdatums en besparingen.",
        ["Komende verlengdatums volgen", "Jaarlijkse kosten berekenen", "Mogelijke besparingen analyseren"],
        ["Dashboard", "Abonnementen", "Categorieën", "Instructies"]),
      locale("Subscription Tracker", "Monitor recurring costs, renewal dates and potential savings.",
        ["Track upcoming renewal dates", "Calculate annual costs", "Analyse potential savings"],
        ["Dashboard", "Subscriptions", "Categories", "Instructions"]),
      locale("Abonnement-Tracker", "Laufende Kosten, Verlängerungen und Sparpotenzial überwachen.",
        ["Kommende Verlängerungstermine verfolgen", "Jährliche Kosten berechnen", "Mögliche Einsparungen analysieren"],
        ["Übersicht", "Abonnements", "Kategorien", "Anleitung"])
    )
  ];

  window.NumberNinjaSupportData = Object.freeze({
    schemaVersion: "1.0.0",
    generatedFrom: Object.freeze([
      "Finance Product Factory product registry",
      "Finance Product Factory reviewed locale catalog",
      "Finance Product Factory commercial listing contract"
    ]),
    products: Object.freeze(products)
  });
}());
