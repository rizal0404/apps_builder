/**
 * Tests for the smart merge module.
 *
 * Run with: npx tsx src/shared/smartMerge.test.ts
 */

import { smartMerge, isTruncationMarker } from './smartMerge';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    if (detail) console.error(`     ${detail}`);
    failed++;
  }
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    console.error(`     Expected:\n${expected.split('\n').map(l => `       |${l}`).join('\n')}`);
    console.error(`     Actual:\n${actual.split('\n').map(l => `       |${l}`).join('\n')}`);
    failed++;
  }
}

// ── Truncation marker detection ─────────────────────────────────────────────────

console.log('\n=== Truncation Marker Detection ===');

assert(isTruncationMarker('  // ... sisanya tetap sama ...'), 'ID: sisanya tetap sama');
assert(isTruncationMarker('  // ... rest stays the same ...'), 'EN: rest stays the same');
assert(isTruncationMarker('// ... existing code remains unchanged ...'), 'EN: existing code remains');
assert(isTruncationMarker('  // ... kode selanjutnya tetap ...'), 'ID: kode selanjutnya tetap');
assert(isTruncationMarker('  // ...'), 'Bare three dots');
assert(isTruncationMarker('  // ....'), 'Bare four dots');
assert(isTruncationMarker('  /* ... rest of code ... */'), 'Block comment');
assert(isTruncationMarker('  /* ... */'), 'Bare block comment dots');
assert(isTruncationMarker('  <!-- ... rest stays the same ... -->'), 'HTML comment');
assert(isTruncationMarker('  <!-- ... -->'), 'Bare HTML comment dots');
assert(isTruncationMarker('  // ... (rest of the code here) ...'), 'EN: rest of the code here');
assert(isTruncationMarker('  // ... dst ...'), 'ID: dst');

assert(!isTruncationMarker('  // This is a normal comment'), 'Normal comment');
assert(!isTruncationMarker('  const x = 5;'), 'Code line');
assert(!isTruncationMarker('  // TODO: fix this'), 'TODO comment');
assert(!isTruncationMarker(''), 'Empty line');

// ── Smart merge: marker at end ──────────────────────────────────────────────────

console.log('\n=== Smart Merge: Marker at End ===');

{
  const original = [
    'function renderTable(data) {',
    '  if (!data) data = [];',
    '  const tbody = document.querySelector("#table tbody");',
    '  tbody.innerHTML = "";',
    '  let totalAll = 0;',
    '  if (data.length === 0) {',
    '    tbody.innerHTML = "No data";',
    '    return;',
    '  }',
    '  data.forEach(function(item) {',
    '    const row = document.createElement("tr");',
    '    row.innerHTML = "<td>" + item.name + "</td>";',
    '    tbody.appendChild(row);',
    '    totalAll += item.amount;',
    '  });',
    '  document.getElementById("total").innerText = totalAll;',
    '}',
  ].join('\n');

  const proposed = [
    'function renderTable(data) {',
    '  if (!data) data = [];',
    '  const tbody = document.querySelector("#table tbody");',
    '  tbody.innerHTML = "";',
    '  let totalAll = 0;',
    '  if (data.length === 0) {',
    '    tbody.innerHTML = "<tr><td>Belum ada transaksi</td></tr>";',
    '    return;',
    '  }',
    '  // ... sisanya tetap sama ...',
  ].join('\n');

  const expected = [
    'function renderTable(data) {',
    '  if (!data) data = [];',
    '  const tbody = document.querySelector("#table tbody");',
    '  tbody.innerHTML = "";',
    '  let totalAll = 0;',
    '  if (data.length === 0) {',
    '    tbody.innerHTML = "<tr><td>Belum ada transaksi</td></tr>";',
    '    return;',
    '  }',
    '  data.forEach(function(item) {',
    '    const row = document.createElement("tr");',
    '    row.innerHTML = "<td>" + item.name + "</td>";',
    '    tbody.appendChild(row);',
    '    totalAll += item.amount;',
    '  });',
    '  document.getElementById("total").innerText = totalAll;',
    '}',
  ].join('\n');

  const result = smartMerge(original, proposed);
  assertEqual(result, expected, 'Marker at end preserves original tail');
}

// ── Smart merge: marker at beginning ────────────────────────────────────────────

console.log('\n=== Smart Merge: Marker at Beginning ===');

{
  const original = [
    'function setupMenu() {',
    '  SpreadsheetApp.getUi()',
    '    .createMenu("MyApp")',
    '    .addItem("Open", "showSidebar")',
    '    .addToUi();',
    '}',
    '',
    'function doGet() {',
    '  return HtmlService.createHtmlOutput("Hello");',
    '}',
  ].join('\n');

  const proposed = [
    '  // ... kode sebelumnya tetap sama ...',
    '',
    'function doGet() {',
    '  return HtmlService.createHtmlOutputFromFile("Index");',
    '}',
  ].join('\n');

  const expected = [
    'function setupMenu() {',
    '  SpreadsheetApp.getUi()',
    '    .createMenu("MyApp")',
    '    .addItem("Open", "showSidebar")',
    '    .addToUi();',
    '}',
    '',
    'function doGet() {',
    '  return HtmlService.createHtmlOutputFromFile("Index");',
    '}',
  ].join('\n');

  const result = smartMerge(original, proposed);
  assertEqual(result, expected, 'Marker at beginning preserves original head');
}

// ── Smart merge: no markers → passthrough ───────────────────────────────────────

console.log('\n=== Smart Merge: No Markers ===');

{
  const original = 'function old() { return 1; }';
  const proposed = 'function newFn() { return 2; }';
  const result = smartMerge(original, proposed);
  assertEqual(result, proposed, 'No markers → proposed returned as-is');
}

// ── Smart merge: new file (no original) ─────────────────────────────────────────

console.log('\n=== Smart Merge: New File ===');

{
  const result = smartMerge('', 'function brand() { return "new"; }');
  assertEqual(result, 'function brand() { return "new"; }', 'Empty original → proposed as-is');
}

// ── Smart merge: marker in middle ───────────────────────────────────────────────

console.log('\n=== Smart Merge: Marker in Middle ===');

{
  const original = [
    '<!DOCTYPE html>',
    '<html>',
    '<head><title>App</title></head>',
    '<body>',
    '  <h1>Dashboard</h1>',
    '  <div id="stats">',
    '    <span>Total: 0</span>',
    '  </div>',
    '  <table id="data">',
    '    <thead><tr><th>Name</th></tr></thead>',
    '    <tbody></tbody>',
    '  </table>',
    '  <script>',
    '    function init() { loadData(); }',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');

  const proposed = [
    '<!DOCTYPE html>',
    '<html>',
    '<head><title>App v2</title></head>',
    '<body>',
    '  <h1>Dashboard v2</h1>',
    '  <!-- ... rest stays the same ... -->',
    '  <script>',
    '    function init() { loadData(); refreshUI(); }',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');

  const expected = [
    '<!DOCTYPE html>',
    '<html>',
    '<head><title>App v2</title></head>',
    '<body>',
    '  <h1>Dashboard v2</h1>',
    '  <div id="stats">',
    '    <span>Total: 0</span>',
    '  </div>',
    '  <table id="data">',
    '    <thead><tr><th>Name</th></tr></thead>',
    '    <tbody></tbody>',
    '  </table>',
    '  <script>',
    '    function init() { loadData(); refreshUI(); }',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');

  const result = smartMerge(original, proposed);
  assertEqual(result, expected, 'Marker in middle preserves original section');
}

// ── Summary ─────────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
