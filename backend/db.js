const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./quotes.db',
  ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});

async function initDb() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      spec TEXT DEFAULT '',
      unit_price REAL NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      note TEXT DEFAULT '',
      total_amount REAL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      total_with_vat REAL DEFAULT 0,
      is_sign_quote INTEGER DEFAULT 0,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      spec TEXT DEFAULT '',
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      total_price REAL NOT NULL,
      calc_type TEXT DEFAULT 'unit',
      width_mm REAL DEFAULT 0,
      height_mm REAL DEFAULT 0,
      area_m2 REAL DEFAULT 0,
      is_finishing INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'flat',
      user_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS option_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER NOT NULL,
      value TEXT NOT NULL,
      extra_price INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS sign_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      user_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS sign_subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      user_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS sign_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subcategory_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      calc_type TEXT NOT NULL DEFAULT 'unit',
      unit_price REAL NOT NULL DEFAULT 0,
      unit_label TEXT DEFAULT '',
      note TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      user_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS finishing_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit_type TEXT NOT NULL DEFAULT 'ea',
      unit_price REAL NOT NULL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      user_id INTEGER
    )`,
  ];

  for (const sql of tables) {
    await client.execute(sql);
  }

  // 기존 DB에 user_id 컬럼이 없는 경우 추가 (마이그레이션)
  const userIdTables = [
    'prices', 'quotes', 'categories', 'options',
    'sign_categories', 'sign_subcategories', 'sign_materials', 'finishing_options',
  ];
  for (const table of userIdTables) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const cols = info.rows.map(row => row[1]); // index 1 = column name
    if (!cols.includes('user_id')) {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
    }
  }

  // quotes 확장 컬럼 마이그레이션
  const quoteInfo = await client.execute('PRAGMA table_info(quotes)');
  const quoteCols = quoteInfo.rows.map(r => r[1]);
  if (!quoteCols.includes('vat_amount'))     await client.execute('ALTER TABLE quotes ADD COLUMN vat_amount REAL DEFAULT 0');
  if (!quoteCols.includes('total_with_vat')) await client.execute('ALTER TABLE quotes ADD COLUMN total_with_vat REAL DEFAULT 0');
  if (!quoteCols.includes('is_sign_quote'))  await client.execute('ALTER TABLE quotes ADD COLUMN is_sign_quote INTEGER DEFAULT 0');

  // quote_items 확장 컬럼 마이그레이션
  const itemInfo = await client.execute('PRAGMA table_info(quote_items)');
  const itemCols = itemInfo.rows.map(r => r[1]);
  if (!itemCols.includes('calc_type'))    await client.execute("ALTER TABLE quote_items ADD COLUMN calc_type TEXT DEFAULT 'unit'");
  if (!itemCols.includes('width_mm'))     await client.execute('ALTER TABLE quote_items ADD COLUMN width_mm REAL DEFAULT 0');
  if (!itemCols.includes('height_mm'))    await client.execute('ALTER TABLE quote_items ADD COLUMN height_mm REAL DEFAULT 0');
  if (!itemCols.includes('area_m2'))      await client.execute('ALTER TABLE quote_items ADD COLUMN area_m2 REAL DEFAULT 0');
  if (!itemCols.includes('is_finishing')) await client.execute('ALTER TABLE quote_items ADD COLUMN is_finishing INTEGER DEFAULT 0');
}

module.exports = { client, initDb };
