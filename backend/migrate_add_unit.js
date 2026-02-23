// migrate_add_unit.js
const Database = require("better-sqlite3");

// DB 파일명은 네가 확인한 quotes.db로 고정
const db = new Database("./quotes.db");

function hasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

const tables = db
  .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
  .all()
  .map((r) => r.name);

console.log("Tables:", tables);

const candidates = ["prices", "price", "items", "unit_prices"];
const table = candidates.find((t) => tables.includes(t));

if (!table) {
  console.log("❌ 가격 테이블을 못 찾았어. 위 Tables 목록을 보고 테이블명을 알려줘.");
  process.exit(1);
}

console.log("Target table:", table);

if (!hasColumn(table, "unit")) {
  db.prepare(`ALTER TABLE ${table} ADD COLUMN unit TEXT DEFAULT '장'`).run();
  console.log("✅ unit 컬럼 추가 완료 (default: '장')");
} else {
  console.log("✅ unit 컬럼은 이미 존재함");
}

db.close();