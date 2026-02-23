import React, { useState, useEffect, useCallback } from 'react';
import { priceAPI } from '../api';

const EMPTY_FORM = { vendor_name: '', product_name: '', spec: '', unit_price: '' };

export default function PriceTable() {
  const [prices, setPrices] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [filterVendor, setFilterVendor] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterVendor) params.vendor = filterVendor;
      if (search) params.search = search;
      const [priceRes, vendorRes] = await Promise.all([
        priceAPI.getAll(params),
        priceAPI.getVendors(),
      ]);
      setPrices(priceRes.data);
      setVendors(vendorRes.data);
    } catch {
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterVendor, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (price) => {
    setEditingId(price.id);
    setForm({
      vendor_name: price.vendor_name,
      product_name: price.product_name,
      spec: price.spec || '',
      unit_price: String(price.unit_price),
    });
    setFormError('');
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor_name.trim() || !form.product_name.trim() || !form.unit_price) {
      setFormError('거래처명, 제품명, 단가는 필수 입력 항목입니다.');
      return;
    }
    if (isNaN(Number(form.unit_price)) || Number(form.unit_price) < 0) {
      setFormError('단가에 올바른 숫자를 입력하세요.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        vendor_name: form.vendor_name.trim(),
        product_name: form.product_name.trim(),
        spec: form.spec.trim(),
        unit_price: Number(form.unit_price),
      };
      if (editingId) {
        await priceAPI.update(editingId, payload);
      } else {
        await priceAPI.create(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await priceAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const fmt = (n) => Number(n).toLocaleString('ko-KR') + '원';

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>단가표 관리</h2>
          <button className="btn btn-primary" onClick={openAdd}>
            <span className="btn-icon">+</span> 단가 추가
          </button>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="search-bar" style={{ marginBottom: '1rem' }}>
            <select
              className="form-control"
              value={filterVendor}
              onChange={e => setFilterVendor(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">전체 거래처</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input
              className="form-control"
              placeholder="제품명 또는 규격 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 300 }}
            />
            {(filterVendor || search) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setFilterVendor(''); setSearch(''); }}
              >
                초기화
              </button>
            )}
          </div>

          {loading ? (
            <div className="loading">데이터를 불러오는 중...</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>거래처명</th>
                    <th>제품명</th>
                    <th>규격/사이즈</th>
                    <th className="text-right">단가</th>
                    <th className="text-center">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        {search || filterVendor ? '검색 결과가 없습니다.' : '등록된 단가 정보가 없습니다. 단가를 추가해보세요.'}
                      </td>
                    </tr>
                  ) : prices.map(p => (
                    <tr key={p.id}>
                      <td>
                        <span className="badge badge-blue">{p.vendor_name}</span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.product_name}</td>
                      <td style={{ color: 'var(--gray-500)' }}>{p.spec || '—'}</td>
                      <td className="text-right">
                        <span className="amount">{fmt(p.unit_price)}</span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(p)}
                          >
                            수정
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(p)}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {prices.length > 0 && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              총 {prices.length}개 항목
            </div>
          )}
        </div>
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingId ? '단가 수정' : '단가 추가'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-group">
                  <label className="form-label">
                    거래처명 <span className="required">*</span>
                  </label>
                  <input
                    className="form-control"
                    name="vendor_name"
                    value={form.vendor_name}
                    onChange={handleFormChange}
                    placeholder="예: (주)ABC"
                    list="vendor-list"
                    autoFocus
                  />
                  <datalist id="vendor-list">
                    {vendors.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    제품명 <span className="required">*</span>
                  </label>
                  <input
                    className="form-control"
                    name="product_name"
                    value={form.product_name}
                    onChange={handleFormChange}
                    placeholder="예: 스테인레스 파이프"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">규격/사이즈</label>
                    <input
                      className="form-control"
                      name="spec"
                      value={form.spec}
                      onChange={handleFormChange}
                      placeholder="예: 50A × 6M"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      단가 (원) <span className="required">*</span>
                    </label>
                    <input
                      className="form-control"
                      name="unit_price"
                      type="number"
                      min="0"
                      step="1"
                      value={form.unit_price}
                      onChange={handleFormChange}
                      placeholder="예: 15000"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '저장 중...' : (editingId ? '수정 완료' : '추가')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>단가 삭제</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                <strong>{deleteTarget.vendor_name}</strong>의{' '}
                <strong>{deleteTarget.product_name}</strong> 단가를 삭제하시겠습니까?<br />
                <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                  이 작업은 되돌릴 수 없습니다.
                </span>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
