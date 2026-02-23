import React, { useState, useEffect, useRef } from 'react';
import { signCategoryAPI, signSubcategoryAPI, signMaterialAPI, finishingAPI, quoteAPI } from '../api';
import QuoteDocument from './QuoteDocument';

const fmt = (n) => Number(n).toLocaleString('ko-KR');

// m² 계산: mm → m²
const calcArea = (w, h) => (Number(w) / 1000) * (Number(h) / 1000);

// 후가공 수량 자동계산 힌트
const calcFinishingQty = (unitType, widthMm, heightMm) => {
  if (unitType === 'm2') return calcArea(widthMm, heightMm);
  if (unitType === 'm') return ((Number(widthMm) + Number(heightMm)) * 2 / 1000);
  return 1;
};

export default function SignQuoteCreate({ onSaved }) {
  const [clientName, setClientName] = useState('');
  const [note, setNote] = useState('');

  // 카테고리 계층
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [finishingOptions, setFinishingOptions] = useState([]);

  // 선택 상태
  const [selCatId, setSelCatId] = useState('');
  const [selSubId, setSelSubId] = useState('');
  const [selMatId, setSelMatId] = useState('');

  // 현재 입력 중인 품목
  const [inputWidthMm, setInputWidthMm] = useState('');
  const [inputHeightMm, setInputHeightMm] = useState('');
  const [inputCharCount, setInputCharCount] = useState('');
  const [inputQty, setInputQty] = useState(1);
  const [inputUnitPrice, setInputUnitPrice] = useState(''); // 단가 직접 수정 가능

  // 품목 목록
  const [items, setItems] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({});

  // 후가공
  const [finishings, setFinishings] = useState([]); // [{ id, name, unit_type, unit_price, qty, custom_price }]

  // 저장
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState(null);
  const docRef = useRef(null);

  useEffect(() => {
    signCategoryAPI.getAll().then(r => setCategories(r.data)).catch(() => {});
    finishingAPI.getAll().then(r => {
      setFinishingOptions(r.data);
      setFinishings(r.data.map(f => ({ ...f, enabled: false, qty: 1, custom_price: f.unit_price })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selCatId) { setSubcategories([]); setSelSubId(''); return; }
    signSubcategoryAPI.getAll(selCatId).then(r => setSubcategories(r.data)).catch(() => {});
    setSelSubId('');
  }, [selCatId]);

  useEffect(() => {
    if (!selSubId) { setMaterials([]); setSelMatId(''); return; }
    signMaterialAPI.getAll(selSubId).then(r => setMaterials(r.data)).catch(() => {});
    setSelMatId('');
  }, [selSubId]);

  // 소재 선택 시 단가 자동 채우기
  useEffect(() => {
    if (!selMatId) { setInputUnitPrice(''); return; }
    const mat = materials.find(m => String(m.id) === String(selMatId));
    if (mat) setInputUnitPrice(String(mat.unit_price));
  }, [selMatId, materials]);

  const selectedMat = materials.find(m => String(m.id) === String(selMatId));
  const calcType = selectedMat?.calc_type || 'unit';

  // 면적 계산
  const area = (calcType === 'm2' && inputWidthMm && inputHeightMm)
    ? calcArea(inputWidthMm, inputHeightMm)
    : 0;

  // 현재 입력 품목 소계
  const currentTotal = (() => {
    const price = Number(inputUnitPrice) || 0;
    const qty = Number(inputQty) || 1;
    if (calcType === 'm2') return price * area * qty;
    if (calcType === 'char') return price * (Number(inputCharCount) || 0) * qty;
    return price * qty;
  })();

  const getSpecText = () => {
    if (calcType === 'm2' && inputWidthMm && inputHeightMm) {
      return `${inputWidthMm}×${inputHeightMm}mm (${area.toFixed(2)}m²)`;
    }
    if (calcType === 'char' && inputCharCount) return `글자수: ${inputCharCount}자`;
    return '';
  };

  const addItem = () => {
    if (!selMatId) { setError('소재를 선택하세요.'); return; }
    if (!inputUnitPrice || Number(inputUnitPrice) < 0) { setError('단가를 확인하세요.'); return; }
    if (calcType === 'm2' && (!inputWidthMm || !inputHeightMm)) { setError('가로/세로를 입력하세요.'); return; }
    if (calcType === 'char' && !inputCharCount) { setError('글자수를 입력하세요.'); return; }
    if (!inputQty || Number(inputQty) < 1) { setError('수량을 입력하세요.'); return; }

    const cat = categories.find(c => String(c.id) === String(selCatId));
    const sub = subcategories.find(s => String(s.id) === String(selSubId));
    const mat = selectedMat;
    const price = Number(inputUnitPrice);
    const qty = Number(inputQty);

    let totalPrice;
    if (calcType === 'm2') totalPrice = price * area * qty;
    else if (calcType === 'char') totalPrice = price * Number(inputCharCount) * qty;
    else totalPrice = price * qty;

    setItems(prev => [...prev, {
      _id: Date.now(),
      product_name: `${cat?.name || ''} > ${sub?.name || ''} > ${mat?.name || ''}`,
      spec: getSpecText(),
      calc_type: calcType,
      width_mm: Number(inputWidthMm) || 0,
      height_mm: Number(inputHeightMm) || 0,
      area_m2: area,
      char_count: Number(inputCharCount) || 0,
      unit_price: price,
      quantity: qty,
      total_price: totalPrice,
    }]);

    // 입력 초기화 (소재/단가는 유지)
    setInputWidthMm('');
    setInputHeightMm('');
    setInputCharCount('');
    setInputQty(1);
    setError('');
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i._id !== id));

  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragId) setDragOverId(id);
  };

  const onDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    setItems(prev => {
      const arr = [...prev];
      const from = arr.findIndex(i => i._id === dragId);
      const to = arr.findIndex(i => i._id === targetId);
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      return arr;
    });
    setDragId(null);
    setDragOverId(null);
  };

  const onDragEnd = () => { setDragId(null); setDragOverId(null); };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(i => {
      if (i._id !== id) return i;
      const updated = { ...i, [field]: value };
      const p = field === 'unit_price' ? Number(value) : i.unit_price;
      const q = field === 'quantity' ? Number(value) : i.quantity;
      if (i.calc_type === 'm2') updated.total_price = p * i.area_m2 * q;
      else if (i.calc_type === 'char') updated.total_price = p * i.char_count * q;
      else updated.total_price = p * q;
      return updated;
    }));
  };

  const startEditItem = (item) => {
    setEditingItemId(item._id);
    setEditItemForm({ product_name: item.product_name, spec: item.spec || '', unit_price: String(item.unit_price), quantity: String(item.quantity) });
  };

  const saveEditItem = () => {
    setItems(prev => prev.map(i => {
      if (i._id !== editingItemId) return i;
      const p = Number(editItemForm.unit_price) || 0;
      const q = Number(editItemForm.quantity) || 1;
      let total;
      if (i.calc_type === 'm2') total = p * i.area_m2 * q;
      else if (i.calc_type === 'char') total = p * i.char_count * q;
      else total = p * q;
      return { ...i, product_name: editItemForm.product_name, spec: editItemForm.spec, unit_price: p, quantity: q, total_price: total };
    }));
    setEditingItemId(null);
  };

  const itemEditKeyDown = (e) => {
    if (e.key === 'Enter') saveEditItem();
    if (e.key === 'Escape') setEditingItemId(null);
  };

  // 후가공 업데이트
  const updateFinishing = (id, field, value) => {
    setFinishings(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  // 후가공 수량 자동계산 (m2, m 타입 + 첫 품목 사이즈 기준)
  const autoFillFinishingQty = (finishingId, unitType) => {
    const firstItem = items[0];
    if (!firstItem) return;
    const autoQty = calcFinishingQty(unitType, firstItem.width_mm, firstItem.height_mm);
    updateFinishing(finishingId, 'qty', Math.round(autoQty * 100) / 100);
  };

  const enabledFinishings = finishings.filter(f => f.enabled);

  // 합계 계산
  const itemsSubtotal = items.reduce((s, i) => s + i.total_price, 0);
  const finishingSubtotal = enabledFinishings.reduce((s, f) => s + (Number(f.custom_price) || 0) * (Number(f.qty) || 1), 0);
  const subtotal = itemsSubtotal + finishingSubtotal;
  const vatAmount = Math.round(subtotal * 0.1);
  const totalWithVat = subtotal + vatAmount;

  const handleSave = async () => {
    if (!clientName.trim()) { setError('고객명을 입력하세요.'); return; }
    if (items.length === 0) { setError('품목을 하나 이상 추가하세요.'); return; }
    setSaving(true);
    setError('');
    try {
      const finishingItems = enabledFinishings.map(f => ({
        product_name: `[후가공] ${f.name}`,
        spec: `${f.qty}${f.unit_type === 'm2' ? 'm²' : f.unit_type === 'm' ? 'm' : '개'}`,
        unit_price: Number(f.custom_price) || 0,
        quantity: Number(f.qty) || 1,
        total_price: (Number(f.custom_price) || 0) * (Number(f.qty) || 1),
        calc_type: 'unit',
        is_finishing: 1,
      }));

      const payload = {
        vendor_name: clientName.trim(),
        note,
        is_sign_quote: 1,
        vat_rate: 0.1,
        items: [
          ...items.map(i => ({
            product_name: i.product_name,
            spec: i.spec,
            unit_price: i.unit_price,
            quantity: i.quantity,
            total_price: i.total_price,
            calc_type: i.calc_type,
            width_mm: i.width_mm,
            height_mm: i.height_mm,
            area_m2: i.area_m2,
            is_finishing: 0,
          })),
          ...finishingItems,
        ],
      };

      const res = await quoteAPI.create(payload);
      setSavedQuote(res.data);
    } catch (err) {
      setError(err.response?.data?.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSavedQuote(null);
    setClientName('');
    setNote('');
    setItems([]);
    setSelCatId('');
    setSelSubId('');
    setSelMatId('');
    setFinishings(prev => prev.map(f => ({ ...f, enabled: false, qty: 1, custom_price: f.unit_price })));
    setError('');
  };

  if (savedQuote) {
    return (
      <div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <h2>견적서 저장 완료</h2>
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={handleReset}>새 견적서 작성</button>
              <button className="btn btn-secondary" onClick={onSaved}>목록 보기</button>
            </div>
          </div>
        </div>
        <QuoteDocument quote={savedQuote} docRef={docRef} />
      </div>
    );
  }

  return (
    <div className="quote-section">
      {error && <div className="alert alert-error">{error}</div>}

      {/* Step 1: 고객 정보 */}
      <div className="card">
        <div className="card-header">
          <h2><span className="section-title"><span className="num">1</span>고객 정보</span></h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">고객명 <span className="required">*</span></label>
              <input
                className="form-control"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="예: 홍길동 / (주)ABC"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">비고</label>
              <input
                className="form-control"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="특이사항, 납기일 등..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: 품목 선택 */}
      <div className="card">
        <div className="card-header">
          <h2><span className="section-title"><span className="num">2</span>품목 선택 &amp; 추가</span></h2>
        </div>
        <div className="card-body">
          {/* 분류 선택 행 */}
          <div className="form-row" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">대분류</label>
              <select className="form-control" value={selCatId} onChange={e => setSelCatId(e.target.value)}>
                <option value="">— 선택 —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">중분류</label>
              <select className="form-control" value={selSubId} onChange={e => setSelSubId(e.target.value)} disabled={!selCatId}>
                <option value="">— 선택 —</option>
                {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label">소재</label>
              <select className="form-control" value={selMatId} onChange={e => setSelMatId(e.target.value)} disabled={!selSubId}>
                <option value="">— 선택 —</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.calc_type === 'm2' ? 'm²당' : m.calc_type === 'char' ? '글자당' : '개당'} {fmt(m.unit_price)}원)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 사이즈/수량 입력 행 */}
          {selectedMat && (
            <div style={{ background: '#f8fafc', border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.75rem' }}>
                {selectedMat.name} —
                {calcType === 'm2' && ' m² 단가: 가로×세로 입력 → 면적 자동계산'}
                {calcType === 'char' && ' 글자당 단가: 글자수 입력'}
                {calcType === 'unit' && ' 개당/건당 단가'}
              </div>
              <div className="form-row" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
                {calcType === 'm2' && (
                  <>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">가로 (mm)</label>
                      <input
                        className="form-control"
                        type="number" min="0" step="1"
                        value={inputWidthMm}
                        onChange={e => setInputWidthMm(e.target.value)}
                        placeholder="예: 3000"
                        style={{ maxWidth: 120 }}
                      />
                    </div>
                    <div style={{ paddingBottom: '0.5rem', color: 'var(--gray-400)' }}>×</div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">세로 (mm)</label>
                      <input
                        className="form-control"
                        type="number" min="0" step="1"
                        value={inputHeightMm}
                        onChange={e => setInputHeightMm(e.target.value)}
                        placeholder="예: 900"
                        style={{ maxWidth: 120 }}
                      />
                    </div>
                    {area > 0 && (
                      <div style={{ paddingBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                        = {area.toFixed(3)} m²
                      </div>
                    )}
                  </>
                )}
                {calcType === 'char' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">글자수</label>
                    <input
                      className="form-control"
                      type="number" min="1" step="1"
                      value={inputCharCount}
                      onChange={e => setInputCharCount(e.target.value)}
                      placeholder="예: 10"
                      style={{ maxWidth: 120 }}
                    />
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    단가 (원/{calcType === 'm2' ? 'm²' : calcType === 'char' ? '글자' : '개'})
                  </label>
                  <input
                    className="form-control"
                    type="number" min="0" step="1"
                    value={inputUnitPrice}
                    onChange={e => setInputUnitPrice(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">수량</label>
                  <input
                    className="form-control"
                    type="number" min="1" step="1"
                    value={inputQty}
                    onChange={e => setInputQty(e.target.value)}
                    style={{ maxWidth: 80 }}
                  />
                </div>
                {currentTotal > 0 && (
                  <div style={{ paddingBottom: '0.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                    = {fmt(Math.round(currentTotal))}원
                  </div>
                )}
                <div style={{ marginBottom: 0 }}>
                  <label className="form-label">&nbsp;</label>
                  <button className="btn btn-primary" onClick={addItem} style={{ display: 'block' }}>
                    + 추가
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: 품목 목록 */}
      {items.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2><span className="section-title"><span className="num">3</span>견적 품목</span></h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }} />
                    <th>품명</th>
                    <th>규격/사이즈</th>
                    <th className="text-right">단가</th>
                    <th className="text-center">수량</th>
                    <th className="text-right">금액</th>
                    <th className="text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item =>
                    editingItemId === item._id ? (
                      <tr key={item._id} style={{ background: '#eff6ff' }}>
                        <td style={{ color: 'var(--gray-300)', textAlign: 'center' }}>⠿</td>
                        <td>
                          <input
                            className="form-control"
                            style={{ fontSize: '0.85rem' }}
                            value={editItemForm.product_name}
                            onChange={e => setEditItemForm(p => ({ ...p, product_name: e.target.value }))}
                            onKeyDown={itemEditKeyDown}
                            autoFocus
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            style={{ fontSize: '0.85rem' }}
                            value={editItemForm.spec}
                            onChange={e => setEditItemForm(p => ({ ...p, spec: e.target.value }))}
                            onKeyDown={itemEditKeyDown}
                            placeholder="규격/사이즈"
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            style={{ fontSize: '0.85rem', textAlign: 'right' }}
                            type="number" min="0" step="1"
                            value={editItemForm.unit_price}
                            onChange={e => setEditItemForm(p => ({ ...p, unit_price: e.target.value }))}
                            onKeyDown={itemEditKeyDown}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            style={{ fontSize: '0.85rem', textAlign: 'center' }}
                            type="number" min="1" step="1"
                            value={editItemForm.quantity}
                            onChange={e => setEditItemForm(p => ({ ...p, quantity: e.target.value }))}
                            onKeyDown={itemEditKeyDown}
                          />
                        </td>
                        <td className="text-right" style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                          —
                        </td>
                        <td className="text-center">
                          <div className="btn-group" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-primary btn-sm" onClick={saveEditItem}>저장</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingItemId(null)}>취소</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={item._id}
                        draggable
                        onDragStart={e => onDragStart(e, item._id)}
                        onDragOver={e => onDragOver(e, item._id)}
                        onDrop={e => onDrop(e, item._id)}
                        onDragEnd={onDragEnd}
                        style={{
                          opacity: dragId === item._id ? 0.4 : 1,
                          borderTop: dragOverId === item._id && dragId !== item._id ? '2px solid var(--primary)' : undefined,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <td style={{ textAlign: 'center', cursor: 'grab', color: 'var(--gray-400)', userSelect: 'none', fontSize: '1rem' }}>⠿</td>
                        <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                        <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{item.spec || '—'}</td>
                        <td className="text-right">{fmt(item.unit_price)}원</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">
                          <span className="amount" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                            {fmt(Math.round(item.total_price))}원
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="btn-group" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => startEditItem(item)}>수정</button>
                            <button className="btn btn-danger btn-sm" onClick={() => removeItem(item._id)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--gray-200)' }}>
            <div className="total-box">
              <span className="total-label">품목 소계</span>
              <span className="total-value">{fmt(Math.round(itemsSubtotal))}원</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: 후가공 선택 */}
      {items.length > 0 && finishings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2><span className="section-title"><span className="num">4</span>후가공 선택</span></h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>선택</th>
                    <th>후가공</th>
                    <th>단위</th>
                    <th className="text-right">단가 (원)</th>
                    <th className="text-center">수량</th>
                    <th className="text-right">소계</th>
                  </tr>
                </thead>
                <tbody>
                  {finishings.map(f => {
                    const lineTotal = f.enabled ? (Number(f.custom_price) || 0) * (Number(f.qty) || 1) : 0;
                    const unitLabel = f.unit_type === 'm2' ? 'm²' : f.unit_type === 'm' ? 'm' : '개/건';
                    return (
                      <tr key={f.id} style={f.enabled ? { background: '#eff6ff' } : {}}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={f.enabled}
                            onChange={e => {
                              updateFinishing(f.id, 'enabled', e.target.checked);
                              if (e.target.checked && (f.unit_type === 'm2' || f.unit_type === 'm') && items[0]) {
                                autoFillFinishingQty(f.id, f.unit_type);
                              }
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ fontWeight: f.enabled ? 600 : 400 }}>{f.name}</td>
                        <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{unitLabel}</td>
                        <td className="text-right">
                          <input
                            className="qty-input"
                            type="number" min="0" step="1"
                            value={f.custom_price}
                            onChange={e => updateFinishing(f.id, 'custom_price', e.target.value)}
                            disabled={!f.enabled}
                            style={{ width: 90, textAlign: 'right' }}
                          />
                        </td>
                        <td className="text-center">
                          <input
                            className="qty-input"
                            type="number" min="0" step="0.01"
                            value={f.qty}
                            onChange={e => updateFinishing(f.id, 'qty', e.target.value)}
                            disabled={!f.enabled}
                            style={{ width: 80 }}
                          />
                        </td>
                        <td className="text-right">
                          {f.enabled && (
                            <span className="amount" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                              {fmt(Math.round(lineTotal))}원
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {finishingSubtotal > 0 && (
              <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--gray-200)' }}>
                <div className="total-box">
                  <span className="total-label">후가공 소계</span>
                  <span className="total-value" style={{ fontSize: '1.1rem', color: 'var(--gray-600)' }}>
                    {fmt(Math.round(finishingSubtotal))}원
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 5: 최종 합계 */}
      {items.length > 0 && (
        <div className="card">
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 400, marginLeft: 'auto' }}>
              <div className="total-box" style={{ justifyContent: 'space-between' }}>
                <span className="total-label" style={{ fontSize: '0.95rem' }}>공급가액</span>
                <span style={{ fontWeight: 600 }}>{fmt(Math.round(subtotal))}원</span>
              </div>
              <div className="total-box" style={{ justifyContent: 'space-between' }}>
                <span className="total-label" style={{ fontSize: '0.95rem' }}>부가세 (10%)</span>
                <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>{fmt(vatAmount)}원</span>
              </div>
              <div style={{ borderTop: '2px solid var(--primary)', paddingTop: '0.5rem' }}>
                <div className="total-box" style={{ justifyContent: 'space-between' }}>
                  <span className="total-label">합계 (VAT 포함)</span>
                  <span className="total-value" style={{ fontSize: '1.5rem' }}>{fmt(totalWithVat)}원</span>
                </div>
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '💾 견적서 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
