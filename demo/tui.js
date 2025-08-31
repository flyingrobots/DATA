#!/usr/bin/env node
const blessed = require("blessed");
const contrib = require("blessed-contrib");
const chalk = require("chalk");

// ===== LCARS theme =====
const LCARS = {
  bg: "#000000",
  text: "#e6e6e6",
  // palette blocks (TNG LCARS-esque)
  amber: "#FF9F3B",
  pumpkin: "#E67E22",
  sand: "#FFCC66",
  grape: "#B98AC9",
  teal: "#72C9BE",
  mint: "#9ED9CF",
  red: "#FF5757",
  kiwi: "#B5D33D",
  steel: "#3A3F44",
};

function pill(txt, ok = true) {
  const c = ok ? LCARS.kiwi : LCARS.red;
  const t = ok ? " OK " : " FAIL ";
  return `{black-fg}{${c}-bg} ${txt} ${t}{/}`;
}

// ===== Screen =====
const screen = blessed.screen({
  smartCSR: true,
  title: "DATA — Database Automation, Testing, and Alignment",
  fullUnicode: true,
});

screen.key(["q", "C-c"], () => process.exit(0));

// ===== Grid layout =====
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

// ===== Header (LCARS bands) =====
const header = blessed.box({
  top: 0,
  left: 0,
  width: "100%",
  height: 3,
  style: { bg: LCARS.bg, fg: LCARS.text },
});
screen.append(header);

const bands = [
  { left: 0, width: "25%", color: LCARS.amber, label: "DATA" },
  { left: "25%", width: "20%", color: LCARS.grape, label: "AUTOMATION" },
  { left: "45%", width: "20%", color: LCARS.teal, label: "TESTING" },
  { left: "65%", width: "20%", color: LCARS.sand, label: "ALIGNMENT" },
  { left: "85%", width: "15%", color: LCARS.pumpkin, label: "BRIDGE" },
];
bands.forEach((b) => {
  const box = blessed.box({
    parent: header,
    top: 0,
    left: b.left,
    width: b.width,
    height: 3,
    tags: true,
    content: ` {bold}${b.label}{/bold} `,
    style: { bg: b.color, fg: "black" },
  });
  return box;
});

// ===== Left column: Ops stack =====
const opsBox = grid.set(3, 0, 9, 3, blessed.box, {
  label: " OPS ",
  tags: true,
  style: { border: { fg: LCARS.amber }, fg: LCARS.text, bg: LCARS.bg },
  border: { type: "line" },
});

const opsList = blessed.list({
  parent: opsBox,
  top: 1,
  left: 1,
  width: "95%",
  height: "95%",
  tags: true,
  keys: false,
  mouse: false,
  vi: false,
  style: {
    selected: { bg: LCARS.grape, fg: "black" },
    item: { fg: LCARS.text },
  },
  items: [],
});

// ===== Center: Telemetry & Log =====
const planBox = grid.set(3, 3, 5, 5, blessed.box, {
  label: " PLAN PREVIEW ",
  tags: true,
  style: { border: { fg: LCARS.teal }, fg: LCARS.text, bg: LCARS.bg },
  border: { type: "line" },
  content: "",
});

const logBox = grid.set(8, 3, 4, 5, contrib.log, {
  label: " SHIP LOG ",
  fg: LCARS.text,
  selectedFg: "white",
  border: { type: "line", fg: LCARS.sand },
});

// ===== Right column: Checks =====
const checksBox = grid.set(3, 8, 9, 4, blessed.box, {
  label: " PROTOCOL CHECKS ",
  tags: true,
  border: { type: "line" },
  style: { border: { fg: LCARS.grape }, fg: LCARS.text, bg: LCARS.bg },
});

const checks = blessed.box({
  parent: checksBox,
  top: 1,
  left: 1,
  width: "95%",
  height: "95%",
  tags: true,
  content: "",
});

// ===== Footer (help) =====
const footer = blessed.box({
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  tags: true,
  style: { bg: LCARS.steel, fg: LCARS.text },
  content:
    "  {bold}q{/bold} quit   {bold}t{/bold} toggle tests   {bold}d{/bold} drift   {bold}p{/bold} plan   {bold}y{/bold} align-prod",
});
screen.append(footer);

// ===== State =====
let testsPassing = true;
let drift = false;
let counter = 0;

function renderChecks() {
  const lines = [
    `${pill("Git clean", true)}  ${pill("On main", true)}`,
    `${pill("Up-to-date", true)}  ${pill("Tag policy", true)}`,
    `${pill("Tests", testsPassing)}  ${pill("Drift", !drift)}`,
  ];
  checks.setContent(lines.join("\n\n"));
}

function renderOps() {
  opsList.setItems([
    `{bold}${chalk.hex(LCARS.amber)("AUTOMATION")}{/bold}`,
    `  Golden SQL: {bold}${drift ? "ahead by 3" : "in sync"}{/bold}`,
    `  Migrations: ${counter} generated`,
    "",
    `{bold}${chalk.hex(LCARS.teal)("TESTING")}{/bold}`,
    `  Suite: ${testsPassing ? "42/42 passing" : "3 failing"}`,
    `  Coverage: 98.7%`,
    "",
    `{bold}${chalk.hex(LCARS.sand)("ALIGNMENT")}{/bold}`,
    `  prod: aligned`,
    `  staging: aligned`,
    `  dev: ${drift ? "3 commits ahead" : "aligned"}`,
  ]);
}

function renderPlan() {
  const content = testsPassing
    ? `{bold}DIFF{/bold}\n  + ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'\n  + CREATE INDEX idx_users_preferences ON users\n\n{bold}Probability of success:{/bold} 99.97%`
    : `{bold}DIFF{/bold}\n  ? Unknown — tests failing\n\n{bold}Recommendation:{/bold} Resolve tests before generating plan.`;
  planBox.setContent(content);
}

function log(line) {
  logBox.log(line);
}

function renderAll() {
  renderChecks();
  renderOps();
  renderPlan();
  screen.render();
}

// ===== Keybindings =====
screen.key("t", () => {
  testsPassing = !testsPassing;
  log(
    testsPassing
      ? "GEORDI: Diagnostics clean. Engines ready."
      : "WORF: We must not proceed. Tests have failed.",
  );
  renderAll();
});

screen.key("d", () => {
  drift = !drift;
  log(drift ? "TROI: I sense… inconsistencies." : "DATA: Alignment restored.");
  renderAll();
});

screen.key("p", () => {
  log("DATA: Computing plan preview…");
  renderPlan();
  renderAll();
});

screen.key("y", () => {
  if (!testsPassing) {
    log("COMPUTER: Alignment prohibited. Tests not passing.");
  } else if (drift) {
    log("DATA: Applying migrations until environment matches golden source…");
    drift = false;
    counter++;
    setTimeout(() => {
      log("PICARD: Make it so.");
      renderAll();
    }, 300);
  } else {
    log("DATA: No changes to apply.");
  }
});

// ===== Kickoff =====
log("🖖 I am Data. Database Automation, Testing, and Alignment.");
renderAll();
