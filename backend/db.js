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
}

module.exports = { client, initDb };
