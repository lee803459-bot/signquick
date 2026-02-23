const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'signquick-secret-key';

app.use(cors());
app.use(bodyParser.json());

// ==================== 인증 미들웨어 ====================

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인하세요.' });
  }
}

// ==================== 인증 API ====================

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

  const password_hash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), password_hash);
  const user = { id: result.lastInsertRowid, username: username.trim() };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!row) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  const user = { id: row.id, username: row.username };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// ==================== 인증 필요 라우트 보호 ====================
app.use('/api/prices', requireAuth);
app.use('/api/vendors', requireAuth);
app.use('/api/quotes', requireAuth);
app.use('/api/categories', requireAuth);
app.use('/api/options', requireAuth);
app.use('/api/sign-categories', requireAuth);
app.use('/api/sign-subcategories', requireAuth);
app.use('/api/sign-materials', requireAuth);
app.use('/api/finishing-options', requireAuth);

// ==================== 단가표 API ====================

// 전체 단가 조회
app.get('/api/prices', (req, res) => {
  const { vendor, search } = req.query;
  let query = 'SELECT * FROM prices';
  const params = [];
  const conditions = [];

  if (vendor) {
    conditions.push('vendor_name = ?');
    params.push(vendor);
  }
  if (search) {
    conditions.push('(product_name LIKE ? OR spec LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY vendor_name, product_name';

  res.json(db.prepare(query).all(...params));
});

// 거래처 목록 조회
app.get('/api/vendors', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT vendor_name FROM prices ORDER BY vendor_name').all();
  res.json(rows.map(r => r.vendor_name));
});

// 단가 추가
app.post('/api/prices', (req, res) => {
  const { vendor_name, product_name, spec, unit_price } = req.body;
  if (!vendor_name || !product_name || unit_price == null) {
    return res.status(400).json({ error: '거래처명, 제품명, 단가는 필수 입력 항목입니다.' });
  }
  const result = db.prepare(
    'INSERT INTO prices (vendor_name, product_name, spec, unit_price) VALUES (?, ?, ?, ?)'
  ).run(vendor_name, product_name, spec || '', Number(unit_price));

  res.status(201).json(db.prepare('SELECT * FROM prices WHERE id = ?').get(result.lastInsertRowid));
});

// 단가 수정
app.put('/api/prices/:id', (req, res) => {
  const { vendor_name, product_name, spec, unit_price } = req.body;
  const { id } = req.params;
  if (!vendor_name || !product_name || unit_price == null) {
    return res.status(400).json({ error: '거래처명, 제품명, 단가는 필수 입력 항목입니다.' });
  }
  db.prepare(
    'UPDATE prices SET vendor_name=?, product_name=?, spec=?, unit_price=? WHERE id=?'
  ).run(vendor_name, product_name, spec || '', Number(unit_price), id);

  res.json(db.prepare('SELECT * FROM prices WHERE id = ?').get(id));
});

// 단가 삭제
app.delete('/api/prices/:id', (req, res) => {
  db.prepare('DELETE FROM prices WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 견적서 API ====================

// 견적서 목록 조회
app.get('/api/quotes', (req, res) => {
  res.json(db.prepare('SELECT * FROM quotes ORDER BY created_at DESC').all());
});

// 견적서 상세 조회
app.get('/api/quotes/:id', (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id);
  res.json({ ...quote, items });
});

// 견적서 저장
app.post('/api/quotes', (req, res) => {
  const { vendor_name, note, items, is_sign_quote, vat_rate } = req.body;
  if (!vendor_name || !items || items.length === 0) {
    return res.status(400).json({ error: '거래처와 품목을 입력하세요.' });
  }

  const total_amount = items.reduce((sum, i) => sum + (i.total_price != null ? i.total_price : i.unit_price * i.quantity), 0);
  const vatRate = is_sign_quote ? (vat_rate != null ? vat_rate : 0.1) : 0;
  const vat_amount = Math.round(total_amount * vatRate);
  const total_with_vat = total_amount + vat_amount;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.prepare('SELECT COUNT(*) as cnt FROM quotes').get().cnt + 1;
  const quote_number = `Q-${dateStr}-${String(count).padStart(4, '0')}`;

  const save = db.transaction(() => {
    const r = db.prepare(
      'INSERT INTO quotes (quote_number, vendor_name, note, total_amount, vat_amount, total_with_vat, is_sign_quote) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(quote_number, vendor_name, note || '', total_amount, vat_amount, total_with_vat, is_sign_quote ? 1 : 0);

    const insertItem = db.prepare(
      'INSERT INTO quote_items (quote_id, product_name, spec, unit_price, quantity, total_price, calc_type, width_mm, height_mm, area_m2, is_finishing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const item of items) {
      const tp = item.total_price != null ? item.total_price : item.unit_price * item.quantity;
      insertItem.run(
        r.lastInsertRowid,
        item.product_name,
        item.spec || '',
        item.unit_price,
        item.quantity,
        tp,
        item.calc_type || 'unit',
        item.width_mm || 0,
        item.height_mm || 0,
        item.area_m2 || 0,
        item.is_finishing ? 1 : 0,
      );
    }
    return r.lastInsertRowid;
  });

  const quoteId = save();
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quoteId);
  const savedItems = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(quoteId);
  res.status(201).json({ ...quote, items: savedItems });
});

// 견적서 삭제
app.delete('/api/quotes/:id', (req, res) => {
  db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 간판 대분류 API ====================

app.get('/api/sign-categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM sign_categories ORDER BY sort_order, id').all());
});

app.post('/api/sign-categories', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '대분류명을 입력하세요.' });
  const cnt = db.prepare('SELECT COUNT(*) as c FROM sign_categories').get().c;
  const result = db.prepare('INSERT INTO sign_categories (name, sort_order) VALUES (?, ?)').run(name.trim(), cnt);
  res.status(201).json(db.prepare('SELECT * FROM sign_categories WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/sign-categories/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '대분류명을 입력하세요.' });
  db.prepare('UPDATE sign_categories SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM sign_categories WHERE id = ?').get(req.params.id));
});

app.delete('/api/sign-categories/:id', (req, res) => {
  db.prepare('DELETE FROM sign_categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 간판 중분류 API ====================

app.get('/api/sign-subcategories', (req, res) => {
  const { categoryId } = req.query;
  if (categoryId) {
    res.json(db.prepare('SELECT * FROM sign_subcategories WHERE category_id = ? ORDER BY sort_order, id').all(categoryId));
  } else {
    res.json(db.prepare('SELECT * FROM sign_subcategories ORDER BY sort_order, id').all());
  }
});

app.post('/api/sign-subcategories', (req, res) => {
  const { name, category_id } = req.body;
  if (!name?.trim() || !category_id) return res.status(400).json({ error: '중분류명과 대분류를 입력하세요.' });
  const cnt = db.prepare('SELECT COUNT(*) as c FROM sign_subcategories WHERE category_id = ?').get(category_id).c;
  const result = db.prepare('INSERT INTO sign_subcategories (category_id, name, sort_order) VALUES (?, ?, ?)').run(category_id, name.trim(), cnt);
  res.status(201).json(db.prepare('SELECT * FROM sign_subcategories WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/sign-subcategories/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '중분류명을 입력하세요.' });
  db.prepare('UPDATE sign_subcategories SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM sign_subcategories WHERE id = ?').get(req.params.id));
});

app.delete('/api/sign-subcategories/:id', (req, res) => {
  db.prepare('DELETE FROM sign_subcategories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 간판 소재/단가 API ====================

app.get('/api/sign-materials', (req, res) => {
  const { subcategoryId } = req.query;
  if (subcategoryId) {
    res.json(db.prepare('SELECT * FROM sign_materials WHERE subcategory_id = ? ORDER BY sort_order, id').all(subcategoryId));
  } else {
    res.json(db.prepare('SELECT * FROM sign_materials ORDER BY sort_order, id').all());
  }
});

app.post('/api/sign-materials/bulk-import', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '가져올 항목이 없습니다.' });
  }

  const validCalcTypes = ['m2', 'unit', 'char'];
  let successCount = 0;
  const errors = [];

  const importAll = db.transaction(() => {
    for (let i = 0; i < items.length; i++) {
      const { category_name, subcategory_name, name, calc_type, unit_price, note } = items[i];
      const rowNum = i + 2;

      if (!category_name?.trim() || !subcategory_name?.trim() || !name?.trim()) {
        errors.push(`${rowNum}행: 대분류·중분류·소재명은 필수입니다.`);
        continue;
      }
      if (unit_price === '' || isNaN(Number(unit_price))) {
        errors.push(`${rowNum}행 (${name}): 단가가 유효하지 않습니다.`);
        continue;
      }

      const ct = validCalcTypes.includes(calc_type) ? calc_type : 'unit';

      let cat = db.prepare('SELECT * FROM sign_categories WHERE name = ?').get(category_name.trim());
      if (!cat) {
        const cnt = db.prepare('SELECT COUNT(*) as c FROM sign_categories').get().c;
        const r = db.prepare('INSERT INTO sign_categories (name, sort_order) VALUES (?, ?)').run(category_name.trim(), cnt);
        cat = db.prepare('SELECT * FROM sign_categories WHERE id = ?').get(r.lastInsertRowid);
      }

      let sub = db.prepare('SELECT * FROM sign_subcategories WHERE category_id = ? AND name = ?').get(cat.id, subcategory_name.trim());
      if (!sub) {
        const cnt = db.prepare('SELECT COUNT(*) as c FROM sign_subcategories WHERE category_id = ?').get(cat.id).c;
        const r = db.prepare('INSERT INTO sign_subcategories (category_id, name, sort_order) VALUES (?, ?, ?)').run(cat.id, subcategory_name.trim(), cnt);
        sub = db.prepare('SELECT * FROM sign_subcategories WHERE id = ?').get(r.lastInsertRowid);
      }

      const matCnt = db.prepare('SELECT COUNT(*) as c FROM sign_materials WHERE subcategory_id = ?').get(sub.id).c;
      db.prepare(
        'INSERT INTO sign_materials (subcategory_id, name, calc_type, unit_price, unit_label, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(sub.id, name.trim(), ct, Number(unit_price) || 0, '', note || '', matCnt);

      successCount++;
    }
  });

  importAll();
  res.json({ success: successCount, errors });
});

app.post('/api/sign-materials', (req, res) => {
  const { subcategory_id, name, calc_type, unit_price, unit_label, note } = req.body;
  if (!subcategory_id || !name?.trim()) return res.status(400).json({ error: '중분류와 소재명을 입력하세요.' });
  const validCalcTypes = ['m2', 'unit', 'char'];
  const ct = validCalcTypes.includes(calc_type) ? calc_type : 'unit';
  const cnt = db.prepare('SELECT COUNT(*) as c FROM sign_materials WHERE subcategory_id = ?').get(subcategory_id).c;
  const result = db.prepare(
    'INSERT INTO sign_materials (subcategory_id, name, calc_type, unit_price, unit_label, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(subcategory_id, name.trim(), ct, Number(unit_price) || 0, unit_label || '', note || '', cnt);
  res.status(201).json(db.prepare('SELECT * FROM sign_materials WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/sign-materials/:id', (req, res) => {
  const { name, calc_type, unit_price, unit_label, note } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '소재명을 입력하세요.' });
  const validCalcTypes = ['m2', 'unit', 'char'];
  const ct = validCalcTypes.includes(calc_type) ? calc_type : 'unit';
  db.prepare(
    'UPDATE sign_materials SET name=?, calc_type=?, unit_price=?, unit_label=?, note=? WHERE id=?'
  ).run(name.trim(), ct, Number(unit_price) || 0, unit_label || '', note || '', req.params.id);
  res.json(db.prepare('SELECT * FROM sign_materials WHERE id = ?').get(req.params.id));
});

app.delete('/api/sign-materials/:id', (req, res) => {
  db.prepare('DELETE FROM sign_materials WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 후가공 API ====================

app.get('/api/finishing-options', (req, res) => {
  res.json(db.prepare('SELECT * FROM finishing_options ORDER BY sort_order, id').all());
});

app.post('/api/finishing-options', (req, res) => {
  const { name, unit_type, unit_price } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '후가공명을 입력하세요.' });
  const validTypes = ['ea', 'm', 'm2'];
  const ut = validTypes.includes(unit_type) ? unit_type : 'ea';
  const cnt = db.prepare('SELECT COUNT(*) as c FROM finishing_options').get().c;
  const result = db.prepare(
    'INSERT INTO finishing_options (name, unit_type, unit_price, sort_order) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), ut, Number(unit_price) || 0, cnt);
  res.status(201).json(db.prepare('SELECT * FROM finishing_options WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/finishing-options/:id', (req, res) => {
  const { name, unit_type, unit_price, is_active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '후가공명을 입력하세요.' });
  const validTypes = ['ea', 'm', 'm2'];
  const ut = validTypes.includes(unit_type) ? unit_type : 'ea';
  db.prepare(
    'UPDATE finishing_options SET name=?, unit_type=?, unit_price=?, is_active=? WHERE id=?'
  ).run(name.trim(), ut, Number(unit_price) || 0, is_active != null ? is_active : 1, req.params.id);
  res.json(db.prepare('SELECT * FROM finishing_options WHERE id = ?').get(req.params.id));
});

app.delete('/api/finishing-options/:id', (req, res) => {
  db.prepare('DELETE FROM finishing_options WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 카테고리 API ====================

// 카테고리 목록 조회
app.get('/api/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
  res.json(rows);
});

// 카테고리 추가
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '카테고리명을 입력하세요.' });
  }
  const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

// 카테고리 삭제
app.delete('/api/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== 옵션 API ====================

// 전체 옵션 조회 (OptionManager용 - flat 구조)
app.get('/api/options', (req, res) => {
  const options = db.prepare('SELECT * FROM options ORDER BY id ASC').all();
  const values = db.prepare('SELECT * FROM option_values').all();
  const result = options.map(opt => ({
    id: opt.id,
    category_id: opt.category_id,
    label: opt.name,
    type: opt.type,
    price_delta: values.filter(v => v.option_id === opt.id)[0]?.extra_price || 0,
  }));
  res.json(result);
});

// 특정 카테고리의 옵션 조회 (QuoteCreate용 - 계층 구조)
app.get('/api/options/category/:categoryId', (req, res) => {
  const options = db.prepare('SELECT * FROM options WHERE category_id = ?').all(req.params.categoryId);
  const allValues = db.prepare('SELECT * FROM option_values').all();
  const result = options.map(opt => ({
    ...opt,
    values: allValues.filter(v => v.option_id === opt.id),
  }));
  res.json(result);
});

// 옵션 추가
app.post('/api/options', (req, res) => {
  const { label, price_delta, category_id } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: '옵션명을 입력하세요.' });
  }
  const delta = Number(price_delta) || 0;
  const result = db.prepare(
    'INSERT INTO options (category_id, name, type) VALUES (?, ?, ?)'
  ).run(category_id || null, label.trim(), 'flat');
  db.prepare(
    'INSERT INTO option_values (option_id, value, extra_price) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, label.trim(), delta);
  res.status(201).json({ id: result.lastInsertRowid, label: label.trim(), price_delta: delta, category_id: category_id || null });
});

// 옵션 삭제
app.delete('/api/options/:id', (req, res) => {
  db.prepare('DELETE FROM option_values WHERE option_id = ?').run(req.params.id);
  db.prepare('DELETE FROM options WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`백엔드 서버 실행 중: http://localhost:${PORT}`);
});
