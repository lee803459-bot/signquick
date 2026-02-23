const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { client, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'signquick-secret-key';

app.use(cors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(bodyParser.json());

// ── DB 쿼리 헬퍼 ────────────────────────────────────────────
// libsql Row는 array-like이므로 컬럼명 기준으로 plain object 변환
const toObj = (row, cols) => {
  if (!row) return null;
  const obj = {};
  cols.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
};

const q = async (sql, args = []) => {
  const safeArgs = args.map(v => (v === undefined ? null : v));
  const res = await client.execute({ sql, args: safeArgs });
  const rows = res.rows.map(row => toObj(row, res.columns));
  return { rows, lastId: res.lastInsertRowid ? Number(res.lastInsertRowid) : null };
};

const getAll  = async (sql, args) => (await q(sql, args)).rows;
const getOne  = async (sql, args) => (await q(sql, args)).rows[0] || null;
const insert  = async (sql, args) => (await q(sql, args)).lastId;
const execute = async (sql, args) => q(sql, args);

// 트랜잭션용 헬퍼
const qTx = async (tx, sql, args = []) => {
  const safeArgs = args.map(v => (v === undefined ? null : v));
  const res = await tx.execute({ sql, args: safeArgs });
  const rows = res.rows.map(row => toObj(row, res.columns));
  return { rows, lastId: res.lastInsertRowid ? Number(res.lastInsertRowid) : null };
};

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

async function seedUserDefaults(userId) {
  const cats = [
    '현수막','배너','실사출력','포스터','롤업배너','패브릭배너',
    '채널간판','아크릴간판','LED간판','입간판','현판','포맥스',
    '실크스크린','차량래핑','명함/스티커',
  ];
  await client.batch(
    cats.map((name, i) => ({
      sql: 'INSERT INTO sign_categories (name, sort_order, user_id) VALUES (?, ?, ?)',
      args: [name, i, userId],
    })),
    'write'
  );

  const fins = [
    ['그로멧(아일렛)', 'ea', 0, 0], ['봉제/미싱', 'm', 0, 1], ['코팅', 'm2', 0, 2],
    ['양면인쇄', 'm2', 0, 3], ['봉삽입', 'ea', 0, 4], ['LED모듈 설치', 'ea', 0, 5],
    ['시공/설치비', 'ea', 0, 6], ['디자인비', 'ea', 0, 7],
  ];
  await client.batch(
    fins.map(f => ({
      sql: 'INSERT INTO finishing_options (name, unit_type, unit_price, sort_order, user_id) VALUES (?, ?, ?, ?, ?)',
      args: [f[0], f[1], f[2], f[3], userId],
    })),
    'write'
  );
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password)
      return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
    if (username.trim().length < 3)
      return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
    if (password.length < 4)
      return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });

    const existing = await getOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

    const password_hash = await bcrypt.hash(password, 10);
    const userId = await insert(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username.trim(), password_hash]
    );

    await seedUserDefaults(userId);

    const user = { id: userId, username: username.trim() };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password)
      return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });

    const row = await getOne('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!row) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    const user = { id: row.id, username: row.username };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
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

app.get('/api/prices', async (req, res) => {
  try {
    const { vendor, search } = req.query;
    const uid = req.user.id;
    let sql = 'SELECT * FROM prices WHERE user_id = ?';
    const args = [uid];
    if (vendor)  { sql += ' AND vendor_name = ?'; args.push(vendor); }
    if (search)  { sql += ' AND (product_name LIKE ? OR spec LIKE ?)'; args.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY vendor_name, product_name';
    res.json(await getAll(sql, args));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/vendors', async (req, res) => {
  try {
    const rows = await getAll('SELECT DISTINCT vendor_name FROM prices WHERE user_id = ? ORDER BY vendor_name', [req.user.id]);
    res.json(rows.map(r => r.vendor_name));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/prices', async (req, res) => {
  try {
    const { vendor_name, product_name, spec, unit_price } = req.body;
    if (!vendor_name || !product_name || unit_price == null)
      return res.status(400).json({ error: '거래처명, 제품명, 단가는 필수 입력 항목입니다.' });
    const id = await insert(
      'INSERT INTO prices (vendor_name, product_name, spec, unit_price, user_id) VALUES (?, ?, ?, ?, ?)',
      [vendor_name, product_name, spec || '', Number(unit_price), req.user.id]
    );
    res.status(201).json(await getOne('SELECT * FROM prices WHERE id = ?', [id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.put('/api/prices/:id', async (req, res) => {
  try {
    const { vendor_name, product_name, spec, unit_price } = req.body;
    if (!vendor_name || !product_name || unit_price == null)
      return res.status(400).json({ error: '거래처명, 제품명, 단가는 필수 입력 항목입니다.' });
    await execute(
      'UPDATE prices SET vendor_name=?, product_name=?, spec=?, unit_price=? WHERE id=? AND user_id=?',
      [vendor_name, product_name, spec || '', Number(unit_price), req.params.id, req.user.id]
    );
    res.json(await getOne('SELECT * FROM prices WHERE id = ?', [req.params.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/prices/:id', async (req, res) => {
  try {
    await execute('DELETE FROM prices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 견적서 API ====================

app.get('/api/quotes', async (req, res) => {
  try {
    res.json(await getAll('SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/quotes/:id', async (req, res) => {
  try {
    const quote = await getOne('SELECT * FROM quotes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!quote) return res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
    const items = await getAll('SELECT * FROM quote_items WHERE quote_id = ?', [req.params.id]);
    res.json({ ...quote, items });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/quotes', async (req, res) => {
  const { vendor_name, note, items, is_sign_quote, vat_rate } = req.body;
  if (!vendor_name || !items || items.length === 0)
    return res.status(400).json({ error: '거래처와 품목을 입력하세요.' });

  const total_amount = items.reduce((sum, i) => sum + (i.total_price != null ? i.total_price : i.unit_price * i.quantity), 0);
  const vatRate = is_sign_quote ? (vat_rate != null ? vat_rate : 0.1) : 0;
  const vat_amount = Math.round(total_amount * vatRate);
  const total_with_vat = total_amount + vat_amount;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const countRow = await getOne('SELECT COUNT(*) as cnt FROM quotes WHERE user_id = ?', [req.user.id]);
  const quote_number = `Q-${dateStr}-${String((countRow?.cnt || 0) + 1).padStart(4, '0')}`;

  const tx = await client.transaction('write');
  try {
    const r = await qTx(tx,
      'INSERT INTO quotes (quote_number, vendor_name, note, total_amount, vat_amount, total_with_vat, is_sign_quote, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [quote_number, vendor_name, note || '', total_amount, vat_amount, total_with_vat, is_sign_quote ? 1 : 0, req.user.id]
    );
    const quoteId = r.lastId;

    for (const item of items) {
      const tp = item.total_price != null ? item.total_price : item.unit_price * item.quantity;
      await qTx(tx,
        'INSERT INTO quote_items (quote_id, product_name, spec, unit_price, quantity, total_price, calc_type, width_mm, height_mm, area_m2, is_finishing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [quoteId, item.product_name, item.spec || '', item.unit_price, item.quantity, tp,
         item.calc_type || 'unit', item.width_mm || 0, item.height_mm || 0, item.area_m2 || 0, item.is_finishing ? 1 : 0]
      );
    }
    await tx.commit();

    const quote = await getOne('SELECT * FROM quotes WHERE id = ?', [quoteId]);
    const savedItems = await getAll('SELECT * FROM quote_items WHERE quote_id = ?', [quoteId]);
    res.status(201).json({ ...quote, items: savedItems });
  } catch (e) {
    await tx.rollback();
    console.error(e);
    res.status(500).json({ error: '서버 오류' });
  }
});

app.delete('/api/quotes/:id', async (req, res) => {
  try {
    await execute('DELETE FROM quotes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 간판 대분류 API ====================

app.get('/api/sign-categories', async (req, res) => {
  try {
    res.json(await getAll('SELECT * FROM sign_categories WHERE user_id = ? ORDER BY sort_order, id', [req.user.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/sign-categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '대분류명을 입력하세요.' });
    const cntRow = await getOne('SELECT COUNT(*) as c FROM sign_categories WHERE user_id = ?', [req.user.id]);
    const id = await insert(
      'INSERT INTO sign_categories (name, sort_order, user_id) VALUES (?, ?, ?)',
      [name.trim(), cntRow?.c || 0, req.user.id]
    );
    res.status(201).json(await getOne('SELECT * FROM sign_categories WHERE id = ?', [id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.put('/api/sign-categories/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '대분류명을 입력하세요.' });
    await execute('UPDATE sign_categories SET name = ? WHERE id = ? AND user_id = ?', [name.trim(), req.params.id, req.user.id]);
    res.json(await getOne('SELECT * FROM sign_categories WHERE id = ?', [req.params.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/sign-categories/:id', async (req, res) => {
  try {
    await execute('DELETE FROM sign_categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 간판 중분류 API ====================

app.get('/api/sign-subcategories', async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (categoryId) {
      res.json(await getAll('SELECT * FROM sign_subcategories WHERE category_id = ? AND user_id = ? ORDER BY sort_order, id', [categoryId, req.user.id]));
    } else {
      res.json(await getAll('SELECT * FROM sign_subcategories WHERE user_id = ? ORDER BY sort_order, id', [req.user.id]));
    }
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/sign-subcategories', async (req, res) => {
  try {
    const { name, category_id } = req.body;
    if (!name?.trim() || !category_id) return res.status(400).json({ error: '중분류명과 대분류를 입력하세요.' });
    const cntRow = await getOne('SELECT COUNT(*) as c FROM sign_subcategories WHERE category_id = ? AND user_id = ?', [category_id, req.user.id]);
    const id = await insert(
      'INSERT INTO sign_subcategories (category_id, name, sort_order, user_id) VALUES (?, ?, ?, ?)',
      [category_id, name.trim(), cntRow?.c || 0, req.user.id]
    );
    res.status(201).json(await getOne('SELECT * FROM sign_subcategories WHERE id = ?', [id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.put('/api/sign-subcategories/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '중분류명을 입력하세요.' });
    await execute('UPDATE sign_subcategories SET name = ? WHERE id = ? AND user_id = ?', [name.trim(), req.params.id, req.user.id]);
    res.json(await getOne('SELECT * FROM sign_subcategories WHERE id = ?', [req.params.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/sign-subcategories/:id', async (req, res) => {
  try {
    await execute('DELETE FROM sign_subcategories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 간판 소재/단가 API ====================

app.get('/api/sign-materials', async (req, res) => {
  try {
    const { subcategoryId } = req.query;
    if (subcategoryId) {
      res.json(await getAll('SELECT * FROM sign_materials WHERE subcategory_id = ? AND user_id = ? ORDER BY sort_order, id', [subcategoryId, req.user.id]));
    } else {
      res.json(await getAll('SELECT * FROM sign_materials WHERE user_id = ? ORDER BY sort_order, id', [req.user.id]));
    }
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/sign-materials/bulk-import', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: '가져올 항목이 없습니다.' });

  const uid = req.user.id;
  const validCalcTypes = ['m2', 'unit', 'char'];
  let successCount = 0;
  const errors = [];

  const tx = await client.transaction('write');
  try {
    for (let i = 0; i < items.length; i++) {
      const { category_name, subcategory_name, name, calc_type, unit_price, note } = items[i];
      const rowNum = i + 2;

      if (!category_name?.trim() || !subcategory_name?.trim() || !name?.trim()) {
        errors.push(`${rowNum}행: 대분류·중분류·소재명은 필수입니다.`); continue;
      }
      if (unit_price === '' || isNaN(Number(unit_price))) {
        errors.push(`${rowNum}행 (${name}): 단가가 유효하지 않습니다.`); continue;
      }
      const ct = validCalcTypes.includes(calc_type) ? calc_type : 'unit';

      let cat = (await qTx(tx, 'SELECT * FROM sign_categories WHERE name = ? AND user_id = ?', [category_name.trim(), uid])).rows[0];
      if (!cat) {
        const cnt = (await qTx(tx, 'SELECT COUNT(*) as c FROM sign_categories WHERE user_id = ?', [uid])).rows[0]?.c || 0;
        const r = await qTx(tx, 'INSERT INTO sign_categories (name, sort_order, user_id) VALUES (?, ?, ?)', [category_name.trim(), cnt, uid]);
        cat = (await qTx(tx, 'SELECT * FROM sign_categories WHERE id = ?', [r.lastId])).rows[0];
      }

      let sub = (await qTx(tx, 'SELECT * FROM sign_subcategories WHERE category_id = ? AND name = ? AND user_id = ?', [cat.id, subcategory_name.trim(), uid])).rows[0];
      if (!sub) {
        const cnt = (await qTx(tx, 'SELECT COUNT(*) as c FROM sign_subcategories WHERE category_id = ? AND user_id = ?', [cat.id, uid])).rows[0]?.c || 0;
        const r = await qTx(tx, 'INSERT INTO sign_subcategories (category_id, name, sort_order, user_id) VALUES (?, ?, ?, ?)', [cat.id, subcategory_name.trim(), cnt, uid]);
        sub = (await qTx(tx, 'SELECT * FROM sign_subcategories WHERE id = ?', [r.lastId])).rows[0];
      }

      const matCnt = (await qTx(tx, 'SELECT COUNT(*) as c FROM sign_materials WHERE subcategory_id = ? AND user_id = ?', [sub.id, uid])).rows[0]?.c || 0;
      await qTx(tx,
        'INSERT INTO sign_materials (subcategory_id, name, calc_type, unit_price, unit_label, note, sort_order, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [sub.id, name.trim(), ct, Number(unit_price) || 0, '', note || '', matCnt, uid]
      );
      successCount++;
    }
    await tx.commit();
    res.json({ success: successCount, errors });
  } catch (e) {
    await tx.rollback();
    console.error(e);
    res.status(500).json({ error: '서버 오류' });
  }
});

app.post('/api/sign-materials', async (req, res) => {
  try {
    const { subcategory_id, name, calc_type, unit_price, unit_label, note } = req.body;
    if (!subcategory_id || !name?.trim()) return res.status(400).json({ error: '중분류와 소재명을 입력하세요.' });
    const validCalcTypes = ['m2', 'unit', 'char'];
    const ct = validCalcTypes.includes(calc_type) ? calc_type : 'unit';
    const cntRow = await getOne('SELECT COUNT(*) as c FROM sign_materials WHERE subcategory_id = ? AND user_id = ?', [subcategory_id, req.user.id]);
    const id = await insert(
      'INSERT INTO sign_materials (subcategory_id, name, calc_type, unit_price, unit_label, note, sort_order, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [subcategory_id, name.trim(), ct, Number(unit_price) || 0, unit_label || '', note || '', cntRow?.c || 0, req.user.id]
    );
    res.status(201).json(await getOne('SELECT * FROM sign_materials WHERE id = ?', [id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.put('/api/sign-materials/:id', async (req, res) => {
  try {
    const { name, calc_type, unit_price, unit_label, note } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '소재명을 입력하세요.' });
    const validCalcTypes = ['m2', 'unit', 'char'];
    const ct = validCalcTypes.includes(calc_type) ? calc_type : 'unit';
    await execute(
      'UPDATE sign_materials SET name=?, calc_type=?, unit_price=?, unit_label=?, note=? WHERE id=? AND user_id=?',
      [name.trim(), ct, Number(unit_price) || 0, unit_label || '', note || '', req.params.id, req.user.id]
    );
    res.json(await getOne('SELECT * FROM sign_materials WHERE id = ?', [req.params.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/sign-materials/:id', async (req, res) => {
  try {
    await execute('DELETE FROM sign_materials WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 후가공 API ====================

app.get('/api/finishing-options', async (req, res) => {
  try {
    res.json(await getAll('SELECT * FROM finishing_options WHERE user_id = ? ORDER BY sort_order, id', [req.user.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/finishing-options', async (req, res) => {
  try {
    const { name, unit_type, unit_price } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '후가공명을 입력하세요.' });
    const validTypes = ['ea', 'm', 'm2'];
    const ut = validTypes.includes(unit_type) ? unit_type : 'ea';
    const cntRow = await getOne('SELECT COUNT(*) as c FROM finishing_options WHERE user_id = ?', [req.user.id]);
    const id = await insert(
      'INSERT INTO finishing_options (name, unit_type, unit_price, sort_order, user_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), ut, Number(unit_price) || 0, cntRow?.c || 0, req.user.id]
    );
    res.status(201).json(await getOne('SELECT * FROM finishing_options WHERE id = ?', [id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.put('/api/finishing-options/:id', async (req, res) => {
  try {
    const { name, unit_type, unit_price, is_active } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '후가공명을 입력하세요.' });
    const validTypes = ['ea', 'm', 'm2'];
    const ut = validTypes.includes(unit_type) ? unit_type : 'ea';
    await execute(
      'UPDATE finishing_options SET name=?, unit_type=?, unit_price=?, is_active=? WHERE id=? AND user_id=?',
      [name.trim(), ut, Number(unit_price) || 0, is_active != null ? is_active : 1, req.params.id, req.user.id]
    );
    res.json(await getOne('SELECT * FROM finishing_options WHERE id = ?', [req.params.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/finishing-options/:id', async (req, res) => {
  try {
    await execute('DELETE FROM finishing_options WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 카테고리 API ====================

app.get('/api/categories', async (req, res) => {
  try {
    res.json(await getAll('SELECT * FROM categories WHERE user_id = ? ORDER BY id ASC', [req.user.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '카테고리명을 입력하세요.' });
    const id = await insert('INSERT INTO categories (name, user_id) VALUES (?, ?)', [name.trim(), req.user.id]);
    res.status(201).json(await getOne('SELECT * FROM categories WHERE id = ?', [id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await execute('DELETE FROM categories WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 옵션 API ====================

app.get('/api/options', async (req, res) => {
  try {
    const options = await getAll('SELECT * FROM options WHERE user_id = ? ORDER BY id ASC', [req.user.id]);
    const values  = await getAll('SELECT * FROM option_values', []);
    res.json(options.map(opt => ({
      id: opt.id, category_id: opt.category_id, label: opt.name, type: opt.type,
      price_delta: values.find(v => v.option_id === opt.id)?.extra_price || 0,
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/options/category/:categoryId', async (req, res) => {
  try {
    const options   = await getAll('SELECT * FROM options WHERE category_id = ? AND user_id = ?', [req.params.categoryId, req.user.id]);
    const allValues = await getAll('SELECT * FROM option_values', []);
    res.json(options.map(opt => ({ ...opt, values: allValues.filter(v => v.option_id === opt.id) })));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/options', async (req, res) => {
  try {
    const { label, price_delta, category_id } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: '옵션명을 입력하세요.' });
    const delta = Number(price_delta) || 0;
    const id = await insert(
      'INSERT INTO options (category_id, name, type, user_id) VALUES (?, ?, ?, ?)',
      [category_id || null, label.trim(), 'flat', req.user.id]
    );
    await insert('INSERT INTO option_values (option_id, value, extra_price) VALUES (?, ?, ?)', [id, label.trim(), delta]);
    res.status(201).json({ id, label: label.trim(), price_delta: delta, category_id: category_id || null });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/options/:id', async (req, res) => {
  try {
    const opt = await getOne('SELECT id FROM options WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!opt) return res.status(404).json({ error: '옵션을 찾을 수 없습니다.' });
    await execute('DELETE FROM option_values WHERE option_id = ?', [req.params.id]);
    await execute('DELETE FROM options WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

// ==================== 서버 시작 ====================

async function startServer() {
  await initDb();
  app.listen(PORT, () => console.log(`사인퀵 서버 실행 중: http://localhost:${PORT}`));
}

startServer().catch(err => { console.error('서버 시작 실패:', err); process.exit(1); });
