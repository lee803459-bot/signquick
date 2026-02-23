const Database = require("better-sqlite3");
const db = new Database("./quotes.db");

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

ALTER TABLE prices ADD COLUMN category_id INTEGER;
`);

console.log("✅ categories 테이블 추가 완료");
db.close();