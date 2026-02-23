const db = require('./db');

// ── 1. sign_categories (대분류) ──────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sign_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );
`);

// ── 2. sign_subcategories (중분류) ───────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sign_subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES sign_categories(id) ON DELETE CASCADE
  );
`);

// ── 3. sign_materials (소재/단가) ─────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sign_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subcategory_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    calc_type TEXT NOT NULL DEFAULT 'unit',
    unit_price REAL NOT NULL DEFAULT 0,
    unit_label TEXT DEFAULT '',
    note TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (subcategory_id) REFERENCES sign_subcategories(id) ON DELETE CASCADE
  );
`);

// ── 4. finishing_options (후가공) ─────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS finishing_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL DEFAULT 'ea',
    unit_price REAL NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );
`);

// ── 5. quotes 테이블 확장 (VAT) ───────────────────────────────
const quoteCols = db.prepare(`PRAGMA table_info(quotes)`).all().map(c => c.name);
if (!quoteCols.includes('vat_amount')) {
  db.exec(`ALTER TABLE quotes ADD COLUMN vat_amount REAL DEFAULT 0`);
}
if (!quoteCols.includes('total_with_vat')) {
  db.exec(`ALTER TABLE quotes ADD COLUMN total_with_vat REAL DEFAULT 0`);
}
if (!quoteCols.includes('is_sign_quote')) {
  db.exec(`ALTER TABLE quotes ADD COLUMN is_sign_quote INTEGER DEFAULT 0`);
}

// ── 6. quote_items 테이블 확장 (calc_type 등) ─────────────────
const itemCols = db.prepare(`PRAGMA table_info(quote_items)`).all().map(c => c.name);
if (!itemCols.includes('calc_type')) {
  db.exec(`ALTER TABLE quote_items ADD COLUMN calc_type TEXT DEFAULT 'unit'`);
}
if (!itemCols.includes('width_mm')) {
  db.exec(`ALTER TABLE quote_items ADD COLUMN width_mm REAL DEFAULT 0`);
}
if (!itemCols.includes('height_mm')) {
  db.exec(`ALTER TABLE quote_items ADD COLUMN height_mm REAL DEFAULT 0`);
}
if (!itemCols.includes('area_m2')) {
  db.exec(`ALTER TABLE quote_items ADD COLUMN area_m2 REAL DEFAULT 0`);
}
if (!itemCols.includes('is_finishing')) {
  db.exec(`ALTER TABLE quote_items ADD COLUMN is_finishing INTEGER DEFAULT 0`);
}

// ── 7. 기본 대분류 15개 시드 ────────────────────────────────────
const catCount = db.prepare(`SELECT COUNT(*) as cnt FROM sign_categories`).get().cnt;
if (catCount === 0) {
  const cats = [
    '현수막', '배너', '실사출력', '포스터', '롤업배너',
    '패브릭배너', '채널간판', '아크릴간판', 'LED간판', '입간판',
    '현판', '포맥스', '실크스크린', '차량래핑', '명함/스티커',
  ];
  const insertCat = db.prepare(`INSERT INTO sign_categories (name, sort_order) VALUES (?, ?)`);
  cats.forEach((name, i) => insertCat.run(name, i));
  console.log(`✓ sign_categories ${cats.length}개 기본값 생성`);
}

// ── 8. 기본 후가공 8개 시드 ─────────────────────────────────────
const finCount = db.prepare(`SELECT COUNT(*) as cnt FROM finishing_options`).get().cnt;
if (finCount === 0) {
  const fins = [
    { name: '그로멧(아일렛)', unit_type: 'ea',  unit_price: 0, sort_order: 0 },
    { name: '봉제/미싱',      unit_type: 'm',   unit_price: 0, sort_order: 1 },
    { name: '코팅',           unit_type: 'm2',  unit_price: 0, sort_order: 2 },
    { name: '양면인쇄',       unit_type: 'm2',  unit_price: 0, sort_order: 3 },
    { name: '봉삽입',         unit_type: 'ea',  unit_price: 0, sort_order: 4 },
    { name: 'LED모듈 설치',   unit_type: 'ea',  unit_price: 0, sort_order: 5 },
    { name: '시공/설치비',    unit_type: 'ea',  unit_price: 0, sort_order: 6 },
    { name: '디자인비',       unit_type: 'ea',  unit_price: 0, sort_order: 7 },
  ];
  const insertFin = db.prepare(
    `INSERT INTO finishing_options (name, unit_type, unit_price, sort_order) VALUES (?, ?, ?, ?)`
  );
  fins.forEach(f => insertFin.run(f.name, f.unit_type, f.unit_price, f.sort_order));
  console.log(`✓ finishing_options ${fins.length}개 기본값 생성`);
}

console.log('✓ 간판 시스템 마이그레이션 완료');
