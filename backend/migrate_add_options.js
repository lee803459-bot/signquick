const Database = require("better-sqlite3");
const db = new Database("./quotes.db");

db.exec(`
CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS option_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  option_id INTEGER,
  value TEXT NOT NULL,
  extra_price INTEGER DEFAULT 0,
  FOREIGN KEY (option_id) REFERENCES options(id)
);
`);

console.log("✅ options 구조 추가 완료");
db.close();