(function exposeCatalog(global) {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function freezeChild(key) {
      deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }

  global.NumberNinjaCatalog = deepFreeze({
    products: [
      {
        id: "budget-planner-basic",
        slug: "budget-planner-basic",
        name: "Budget Planner Basic",
        status: "coming-soon",
        statusLabel: "Coming soon",
        type: "Excel workbook",
        shortDescription: "A validated Excel budget workbook built for clear income, expense and category tracking.",
        targetAudience: "People who want a structured starting point for personal budget tracking.",
        features: [
          "Genuine .xlsx output",
          "Dashboard, Income, Expenses and Categories sheets",
          "SUM, SUMIF and SUMIFS formulas",
          "Workbook structure validation"
        ],
        sheets: ["Dashboard", "Income", "Expenses", "Categories"],
        formulaFamilies: ["SUM", "SUMIF", "SUMIFS"],
        availability: "preview-only",
        detailHref: "budget-planner-basic.html",
        cta: {
          label: "View product preview",
          href: "budget-planner-basic.html"
        }
      }
    ],
    bundles: [
      { id: "finance-bundle", name: "Finance Bundle", statusLabel: "Coming soon" },
      { id: "excel-bundle", name: "Excel Bundle", statusLabel: "Coming soon" },
      { id: "data-analyst-bundle", name: "Data Analyst Bundle", statusLabel: "Coming soon" }
    ],
    resources: []
  });
})(window);
