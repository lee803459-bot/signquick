const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'quotes.db'));

db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    spec TEXT DEFAULT '',
    unit_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    note TEXT DEFAULT '',
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    spec TEXT DEFAULT '',
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'flat',
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS option_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_id INTEGER NOT NULL,
    value TEXT NOT NULL,
    extra_price INTEGER DEFAULT 0,
    FOREIGN KEY (option_id) REFERENCES options(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sign_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sign_subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES sign_categories(id) ON DELETE CASCADE
  );

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

  CREATE TABLE IF NOT EXISTS finishing_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit_type TEXT NOT NULL DEFAULT 'ea',
    unit_price REAL NOT NULL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );
`);

// ── 컬럼 마이그레이션 (기존 DB 호환) ─────────────────────────

const quoteCols = db.prepare('PRAGMA table_info(quotes)').all().map(c => c.name);
if (!quoteCols.includes('vat_amount'))    db.exec('ALTER TABLE quotes ADD COLUMN vat_amount REAL DEFAULT 0');
if (!quoteCols.includes('total_with_vat')) db.exec('ALTER TABLE quotes ADD COLUMN total_with_vat REAL DEFAULT 0');
if (!quoteCols.includes('is_sign_quote')) db.exec('ALTER TABLE quotes ADD COLUMN is_sign_quote INTEGER DEFAULT 0');

const itemCols = db.prepare('PRAGMA table_info(quote_items)').all().map(c => c.name);
if (!itemCols.includes('calc_type'))    db.exec("ALTER TABLE quote_items ADD COLUMN calc_type TEXT DEFAULT 'unit'");
if (!itemCols.includes('width_mm'))     db.exec('ALTER TABLE quote_items ADD COLUMN width_mm REAL DEFAULT 0');
if (!itemCols.includes('height_mm'))    db.exec('ALTER TABLE quote_items ADD COLUMN height_mm REAL DEFAULT 0');
if (!itemCols.includes('area_m2'))      db.exec('ALTER TABLE quote_items ADD COLUMN area_m2 REAL DEFAULT 0');
if (!itemCols.includes('is_finishing')) db.exec('ALTER TABLE quote_items ADD COLUMN is_finishing INTEGER DEFAULT 0');

// ── user_id 컬럼 마이그레이션 (사용자별 데이터 분리) ──────────

const userIdTables = [
  'prices', 'quotes', 'categories', 'options',
  'sign_categories', 'sign_subcategories', 'sign_materials', 'finishing_options',
];
for (const table of userIdTables) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes('user_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
  }
}

module.exports = db;
