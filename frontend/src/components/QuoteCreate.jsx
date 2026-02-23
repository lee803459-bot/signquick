import React, { useState, useEffect, useRef } from 'react';
import { priceAPI, quoteAPI, categoryAPI, optionAPI } from '../api';
import QuoteDocument from './QuoteDocument';

export default function QuoteCreate({ onSaved }) {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [selectedOptionValues, setSelectedOptionValues] = useState({});
  const docRef = useRef(null);

  useEffect(() => {
    priceAPI.getVendors().then(r => setVendors(r.data)).catch(() => {});
    categoryAPI.getAll().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedVendor) {
      setAvailableProducts([]);
      return;
    }
    priceAPI.getAll({ vendor: selectedVendor }).then(r => {
      setAvailableProducts(r.data);
    }).catch(() => {});
    setItems([]);
    setProductSearch('');
    setSelectedCategory('');
    setCategoryOptions([]);
    setSelectedOptionValues({});
  }, [selectedVendor]);

  useEffect(() => {
    if (!selectedCategory) {
      setCategoryOptions([]);
      setSelectedOptionValues({});
      return;
    }
    optionAPI.getByCategoryId(selectedCategory).then(r => {
      setCategoryOptions(r.data.filter(opt => opt.values && opt.values.length > 0));
      setSelectedOptionValues({});
    }).catch(() => {});
  }, [selectedCategory]);

  const addItem = (product) => {
    const exists = items.find(i => i.price_id === product.id);
    if (exists) return;
    setItems(prev => [...prev, {
      price_id: product.id,
      product_name: product.product_name,
      spec: product.spec,
      unit_price: product.unit_price,
      quantity: 1,
    }]);
  };

  const removeItem = (price_id) => {
    setItems(prev => prev.filter(i => i.price_id !== price_id));
  };

  const updateQty = (price_id, qty) => {
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 0) return;
    setItems(prev => prev.map(i => i.price_id === price_id ? { ...i, quantity: n } : i));
  };

  const fmt = (n) => Number(n).toLocaleString('ko-KR');

  const filteredProducts = availableProducts.filter(p => {
    if (selectedCategory && String(p.category_id) !== String(selectedCategory)) return false;
    if (!productSearch) return true;
    const q = productSearch.toLowerCase();
    return p.product_name.toLowerCase().includes(q) || (p.spec || '').toLowerCase().includes(q);
  });

  const optionExtra = categoryOptions.reduce((sum, opt) => {
    const valId = selectedOptionValues[opt.id];
    if (!valId) return sum;
    const val = opt.values.find(v => v.id === Number(valId));
    return sum + (val?.extra_price || 0);
  }, 0);

  const itemsTotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const total = itemsTotal + optionExtra;

  const handleSave = async () => {
    if (!selectedVendor) { setError('거래처를 선택하세요.'); return; }
    if (items.length === 0) { setError('품목을 하나 이상 추가하세요.'); return; }
    const badQty = items.find(i => !i.quantity || i.quantity < 1);
    if (badQty) { setError(`"${badQty.product_name}"의 수량을 1 이상으로 입력하세요.`); return; }
    setSaving(true);
    setError('');
    try {
      const optionItems = categoryOptions
        .filter(opt => selectedOptionValues[opt.id])
        .map(opt => {
          const val = opt.values.find(v => v.id === Number(selectedOptionValues[opt.id]));
          return {
            product_name: `[옵션] ${opt.name}: ${val.value}`,
            spec: '',
            unit_price: val.extra_price,
            quantity: 1,
          };
        })
        .filter(i => i.unit_price > 0);

      const res = await quoteAPI.create({
        vendor_name: selectedVendor,
        note,
        items: [
          ...items.map(i => ({
            product_name: i.product_name,
            spec: i.spec,
            unit_price: i.unit_price,
            quantity: i.quantity,
          })),
          ...optionItems,
        ],
      });
      setSavedQuote(res.data);
    } catch (err) {
      setError(err.response?.data?.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSavedQuote(null);
    setSelectedVendor('');
    setItems([]);
    setNote('');
    setError('');
  };

  if (savedQuote) {
    return (
      <div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <h2>견적서 저장 완료</h2>
            <div className="btn-group">
              <button className="btn btn-secondary" onClick={handleReset}>
                새 견적서 작성
              </button>
              <button className="btn btn-secondary" onClick={onSaved}>
                목록 보기
              </button>
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

      {/* Step 1: 거래처 선택 */}
      <div className="card">
        <div className="card-header">
          <h2>
            <span className="section-title">
              <span className="num">1</span>
              거래처 선택
            </span>
          </h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">거래처명 <span className="required">*</span></label>
              <select
                className="form-control"
                value={selectedVendor}
                onChange={e => setSelectedVendor(e.target.value)}
              >
                <option value="">— 거래처를 선택하세요 —</option>
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              {vendors.length === 0 && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                  단가표에 거래처를 먼저 등록해주세요.
                </p>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">비고</label>
              <input
                className="form-control"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="특이사항, 메모 등..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: 품목 선택 */}
      {selectedVendor && (
        <div className="card">
          <div className="card-header">
            <h2>
              <span className="section-title">
                <span className="num">2</span>
                품목 선택 — {selectedVendor}
              </span>
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                className="form-control"
                style={{ maxWidth: 180 }}
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="">전체 카테고리</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                className="form-control"
                style={{ maxWidth: 220 }}
                placeholder="제품명 또는 규격 검색..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>제품명</th>
                    <th>규격/사이즈</th>
                    <th className="text-right">단가</th>
                    <th className="text-center">추가</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="table-empty">
                        {productSearch ? '검색 결과가 없습니다.' : '등록된 제품이 없습니다.'}
                      </td>
                    </tr>
                  ) : filteredProducts.map(p => {
                    const added = items.some(i => i.price_id === p.id);
                    return (
                      <tr key={p.id} style={added ? { background: '#eff6ff' } : {}}>
                        <td style={{ fontWeight: 500 }}>{p.product_name}</td>
                        <td style={{ color: 'var(--gray-500)' }}>{p.spec || '—'}</td>
                        <td className="text-right">
                          <span className="amount">{fmt(p.unit_price)}원</span>
                        </td>
                        <td className="text-center">
                          <button
                            className={`btn btn-sm ${added ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => added ? removeItem(p.id) : addItem(p)}
                          >
                            {added ? '제거' : '+ 추가'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 수량 입력 및 합계 */}
      {items.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>
              <span className="section-title">
                <span className="num">3</span>
                수량 입력 및 합계
              </span>
            </h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>제품명</th>
                    <th>규격/사이즈</th>
                    <th className="text-right">단가</th>
                    <th className="text-center">수량</th>
                    <th className="text-right">금액</th>
                    <th className="text-center">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.price_id}>
                      <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                      <td style={{ color: 'var(--gray-500)' }}>{item.spec || '—'}</td>
                      <td className="text-right">
                        <span className="amount">{fmt(item.unit_price)}원</span>
                      </td>
                      <td className="text-center">
                        <input
                          className="qty-input"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateQty(item.price_id, e.target.value)}
                        />
                      </td>
                      <td className="text-right">
                        <span className="amount" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                          {fmt(item.unit_price * item.quantity)}원
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => removeItem(item.price_id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--gray-200)' }}>
            <div className="total-box">
              <span className="total-label">품목 소계</span>
              <span className="total-value">{fmt(itemsTotal)}원</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: 옵션 선택 */}
      {items.length > 0 && selectedCategory && categoryOptions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>
              <span className="section-title">
                <span className="num">4</span>
                옵션 선택
              </span>
            </h2>
          </div>
          <div className="card-body">
            <div className="form-row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              {categoryOptions.map(opt => (
                <div className="form-group" key={opt.id} style={{ marginBottom: 0, minWidth: 200 }}>
                  <label className="form-label">{opt.name}</label>
                  <select
                    className="form-control"
                    value={selectedOptionValues[opt.id] || ''}
                    onChange={e => setSelectedOptionValues(prev => ({ ...prev, [opt.id]: e.target.value }))}
                  >
                    <option value="">선택 안함</option>
                    {opt.values.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.value}{v.extra_price > 0 ? ` (+${fmt(v.extra_price)}원)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {optionExtra > 0 && (
              <div className="total-box" style={{ marginTop: '1rem' }}>
                <span className="total-label">옵션 추가금액</span>
                <span className="total-value" style={{ color: 'var(--gray-600)', fontSize: '1.1rem' }}>
                  +{fmt(optionExtra)}원
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 최종 합계 및 저장 */}
      {items.length > 0 && (
        <div className="card">
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div className="total-box">
              <span className="total-label">합계 금액</span>
              <span className="total-value">{fmt(total)}원</span>
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
