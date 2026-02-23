const Database = require("better-sqlite3");
const db = new Database("./quotes.db");

db.exec(`
CREATE TABLE IF NOT EXISTS 상품군 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  상품군명 TEXT NOT NULL,
  기본단가 INTEGER NOT NULL,
  단위 TEXT DEFAULT '㎡'
);

CREATE TABLE IF NOT EXISTS 선택항목 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  상품군id INTEGER,
  항목명 TEXT NOT NULL,
  유형 TEXT NOT NULL,
  FOREIGN KEY (상품군id) REFERENCES 상품군(id)
);

CREATE TABLE IF NOT EXISTS 선택값 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  선택항목id INTEGER,
  값명 TEXT NOT NULL,
  가산금액 INTEGER DEFAULT 0,
  FOREIGN KEY (선택항목id) REFERENCES 선택항목(id)
);
`);

console.log("✅ 상품군/선택항목 구조 생성 완료");
db.close();