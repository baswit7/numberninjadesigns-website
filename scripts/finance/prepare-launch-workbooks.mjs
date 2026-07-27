import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const artifactToolSpecifier = process.env.NND_ARTIFACT_TOOL_MODULES
  ? pathToFileURL(
      path.join(
        process.env.NND_ARTIFACT_TOOL_MODULES,
        "@oai",
        "artifact-tool",
        "dist",
        "artifact_tool.mjs",
      ),
    ).href
  : "@oai/artifact-tool";
const { FileBlob, SpreadsheetFile } = await import(artifactToolSpecifier);

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const sourceRoot = path.join(
  repositoryRoot,
  "outputs",
  "finance-product-factory",
);
const releaseRoot = path.join(
  repositoryRoot,
  "release-candidates",
  "finance-launch-2026-07-24",
);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function excelSerial(year, monthIndex, day) {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return (Date.UTC(year, monthIndex, day) - excelEpoch) / 86_400_000;
}

function formulaColumn(startRow, endRow, factory) {
  return Array.from({ length: endRow - startRow + 1 }, (_, index) => [
    factory(startRow + index),
  ]);
}

function formulaGrid(startRow, endRow, factories) {
  return Array.from({ length: endRow - startRow + 1 }, (_, index) =>
    factories.map((factory) => factory(startRow + index)),
  );
}

function setChartData(sheet, rangeAddress, title, colors) {
  const chart = sheet.charts.items[0];
  if (!chart) {
    throw new Error(`Expected one chart on ${sheet.name}.`);
  }

  chart.setData(sheet.getRange(rangeAddress));
  chart.title = title;
  chart.hasLegend = true;
  chart.titleTextStyle.fontSize = 12;
  chart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
  chart.yAxis = {
    numberFormatCode: "€#,##0",
    textStyle: { fontSize: 9 },
  };

  chart.series.items.forEach((series, index) => {
    series.fill = colors[index % colors.length];
  });
}

function prepareBudgetPlanner(workbook) {
  const start = workbook.worksheets.getItem("Start");
  const setup = workbook.worksheets.getItem("Setup");
  const transactions = workbook.worksheets.getItem("Transactions");
  const monthlyBudget = workbook.worksheets.getItem("Monthly Budget");
  const savingsGoals = workbook.worksheets.getItem("Savings Goals");
  const dashboard = workbook.worksheets.getItem("Dashboard");

  start.getRange("A2").values = [
    ["NumberNinjaDesigns | Digital Production | Version 1.0.1"],
  ];
  start.getRange("C7").values = [
    [
      "Replace the sample transactions, monthly budgets, savings goals, and selected budget month with your own values.",
    ],
  ];

  setup.getRange("D9:E9").copyFrom(setup.getRange("D8:E8"), "all");
  setup.getRange("D9:E9").values = [["Budget month", "Jan"]];
  setup.getRange("E9").dataValidation = {
    rule: { type: "list", values: MONTHS },
  };

  const transactionRows = [];
  const expenseProfiles = [
    [1200, 365, 500, 195],
    [1200, 388, 500, 188],
    [1200, 410, 525, 201],
    [1200, 372, 525, 176],
    [1200, 436, 550, 184],
    [1200, 402, 550, 172],
    [1200, 455, 575, 165],
    [1200, 421, 575, 168],
    [1200, 397, 600, 179],
    [1200, 443, 600, 193],
    [1200, 409, 625, 211],
    [1200, 468, 650, 224],
  ];

  MONTHS.forEach((month, monthIndex) => {
    const salary = monthIndex === 5 || monthIndex === 11 ? 3900 : 3500;
    const [housing, groceries, savings, utilities] =
      expenseProfiles[monthIndex];
    const date = (day) => excelSerial(2026, monthIndex, day);

    transactionRows.push(
      [date(1), month, "Income", "Salary", "Monthly salary", salary],
      [date(2), month, "Expense", "Housing", "Rent", housing],
      [date(8), month, "Expense", "Groceries", "Groceries", groceries],
      [date(15), month, "Expense", "Savings", "Savings transfer", savings],
      [date(21), month, "Expense", "Utilities", "Utilities", utilities],
    );
  });

  transactions.getRange("A6:F206").values = Array.from(
    { length: 201 },
    () => [null, null, null, null, null, null],
  );
  transactions.getRange(`A6:F${5 + transactionRows.length}`).values =
    transactionRows;
  transactions.getRange("A6:A206").setNumberFormat("yyyy-mm-dd");

  monthlyBudget.getRange("A2").values = [
    ["Plan versus actual expenses for the month selected in Setup"],
  ];
  monthlyBudget.getRange("C6:C17").formulas = formulaColumn(
    6,
    17,
    (row) =>
      `=SUMIFS('Transactions'!$F$6:$F$206,'Transactions'!$C$6:$C$206,"Expense",'Transactions'!$D$6:$D$206,A${row},'Transactions'!$B$6:$B$206,'Setup'!$E$9)`,
  );

  savingsGoals.getRange("D6:E15").formulas = formulaGrid(6, 15, [
    (row) => `=IF(A${row}="","",MAX(B${row}-C${row},0))`,
    (row) =>
      `=IF(A${row}="","",IF(B${row}=0,0,C${row}/B${row}))`,
  ]);

  dashboard.getRange("A2").values = [
    ["Selected-month cash flow, budget control, and 12-month trend"],
  ];
  dashboard.getRange("A3:B3").values = [["Selected month", null]];
  dashboard.getRange("B3").formulas = [["='Setup'!E9"]];
  dashboard.getRange("B5").formulas = [
    [
      `=SUMIFS('Transactions'!$F$6:$F$206,'Transactions'!$C$6:$C$206,"Income",'Transactions'!$B$6:$B$206,'Setup'!$E$9)`,
    ],
  ];
  dashboard.getRange("B6").formulas = [
    [
      `=SUMIFS('Transactions'!$F$6:$F$206,'Transactions'!$C$6:$C$206,"Expense",'Transactions'!$B$6:$B$206,'Setup'!$E$9)`,
    ],
  ];
  dashboard.getRange("B7:B10").formulas = [
    ["=B5-B6"],
    ["=IF(B5=0,0,B7/B5)"],
    ["='Monthly Budget'!B19"],
    ["='Monthly Budget'!D19"],
  ];
  setChartData(
    dashboard,
    "A13:D25",
    "Monthly Cash Flow (€)",
    ["#00FF94", "#FF7849", "#2F80ED"],
  );
}

function prepareDebtTracker(workbook) {
  const start = workbook.worksheets.getItem("Start");
  const debts = workbook.worksheets.getItem("Debts");
  const paymentLog = workbook.worksheets.getItem("Payment Log");
  const dashboard = workbook.worksheets.getItem("Dashboard");

  start.getRange("A2").values = [
    ["NumberNinjaDesigns | Digital Production | Version 1.0.1"],
  ];

  debts.getRange("G6:I25").formulas = formulaGrid(6, 25, [
    (row) => `=IF(A${row}="","",E${row}+F${row})`,
    (row) => `=IF(A${row}="","",C${row}*D${row}/12)`,
    (row) =>
      `=IF(A${row}="","",IF(C${row}<=0,"Paid",IF(G${row}<=H${row},"Increase payment","On track")))`,
  ]);

  const paymentDates = [
    excelSerial(2026, 0, 31),
    excelSerial(2026, 0, 31),
    excelSerial(2026, 0, 31),
  ];
  paymentLog.getRange("A6:A8").values = paymentDates.map((value) => [value]);
  paymentLog.getRange("A6:A206").setNumberFormat("yyyy-mm-dd");
  paymentLog.getRange("E6:E206").formulas = formulaColumn(
    6,
    206,
    (row) => `=IF(B${row}="","",C${row}+D${row})`,
  );

  dashboard.getRange("A14:C33").formulas = formulaGrid(14, 33, [
    (row) =>
      `=IF('Debts'!A${row - 8}="","",'Debts'!A${row - 8})`,
    (row) =>
      `=IF('Debts'!A${row - 8}="","",'Debts'!B${row - 8})`,
    (row) =>
      `=IF('Debts'!A${row - 8}="","",'Debts'!C${row - 8})`,
  ]);
  setChartData(
    dashboard,
    "A13:C33",
    "Debt Balance Comparison (€)",
    ["#00FF94", "#FF7849"],
  );
}

function prepareNetWorthTracker(workbook) {
  const start = workbook.worksheets.getItem("Start");
  const history = workbook.worksheets.getItem("History");
  const dashboard = workbook.worksheets.getItem("Dashboard");

  start.getRange("A2").values = [
    ["NumberNinjaDesigns | Digital Production | Version 1.0.1"],
  ];

  const historyRows = [
    [excelSerial(2025, 6, 31), 31_000, 32_000],
    [excelSerial(2025, 7, 31), 31_500, 31_800],
    [excelSerial(2025, 8, 30), 32_100, 31_500],
    [excelSerial(2025, 9, 31), 32_700, 31_200],
    [excelSerial(2025, 10, 30), 33_200, 30_900],
    [excelSerial(2025, 11, 31), 33_700, 30_600],
    [excelSerial(2026, 0, 31), 34_000, 30_500],
    [excelSerial(2026, 1, 28), 34_700, 29_900],
    [excelSerial(2026, 2, 31), 35_000, 29_400],
    [excelSerial(2026, 3, 30), 35_200, 29_200],
    [excelSerial(2026, 4, 31), 35_400, 29_000],
    [excelSerial(2026, 5, 30), 35_700, 28_700],
  ];
  history.getRange("A6:C65").values = Array.from(
    { length: 60 },
    () => [null, null, null],
  );
  history.getRange("A6:C17").values = historyRows;
  history.getRange("A6:A65").setNumberFormat("mmm yyyy");
  history.getRange("D6:D65").formulas = formulaColumn(
    6,
    65,
    (row) =>
      `=IF(OR(A${row}="",B${row}="",C${row}=""),"",B${row}-C${row})`,
  );

  dashboard.getRange("B9").formulas = [
    [
      `=IFERROR(INDEX('History'!$D$6:$D$65,COUNT('History'!$A$6:$A$65)),0)`,
    ],
  ];
  dashboard.getRange("A14:B73").values = Array.from(
    { length: 60 },
    () => [null, null],
  );
  dashboard.getRange("A14:B25").formulas = formulaGrid(14, 25, [
    () =>
      `=IF(COUNT('History'!$A$6:$A$65)=0,"",INDEX('History'!$A$6:$A$65,MAX(1,COUNT('History'!$A$6:$A$65)-12+ROW()-13)))`,
    () =>
      `=IF(COUNT('History'!$A$6:$A$65)=0,"",INDEX('History'!$D$6:$D$65,MAX(1,COUNT('History'!$A$6:$A$65)-12+ROW()-13)))`,
  ]);
  dashboard.getRange("A14:A25").setNumberFormat("mmm yyyy");
  setChartData(
    dashboard,
    "A13:B25",
    "Net Worth Trend (€)",
    ["#00FF94"],
  );
}

const products = [
  {
    id: "budget-planner",
    source: "NumberNinja-Budget-Planner.xlsx",
    output: "NumberNinja-Budget-Planner-v1.0.1.xlsx",
    prepare: prepareBudgetPlanner,
  },
  {
    id: "debt-payoff-tracker",
    source: "NumberNinja-Debt-Payoff-Tracker.xlsx",
    output: "NumberNinja-Debt-Payoff-Tracker-v1.0.1.xlsx",
    prepare: prepareDebtTracker,
  },
  {
    id: "net-worth-tracker",
    source: "NumberNinja-Net-Worth-Tracker.xlsx",
    output: "NumberNinja-Net-Worth-Tracker-v1.0.1.xlsx",
    prepare: prepareNetWorthTracker,
  },
];

for (const product of products) {
  const inputPath = path.join(sourceRoot, product.id, product.source);
  const productOutputDir = path.join(releaseRoot, product.id);
  const outputPath = path.join(productOutputDir, product.output);

  await fs.mkdir(productOutputDir, { recursive: true });
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(inputPath),
  );
  product.prepare(workbook);

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  process.stdout.write(`${product.id}: ${outputPath}\n`);
}
