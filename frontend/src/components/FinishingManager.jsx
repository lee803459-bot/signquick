import React, { useState, useEffect, useCallback, useRef } from 'react';
import { finishingAPI } from '../api';

const UNIT_TYPE_LABELS = {
  ea: '개당 / 건당',
  m:  'm당 (길이)',
  m2: 'm²당 (면적)',
};

const EMPTY_NEW = { name: '', unit_type: 'ea', unit_price: '' };

export default function FinishingManager() {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);   // 수정 중인 행 id
  const [editForm, setEditForm] = useState({});        // 수정 중인 값
  const [newRow, setNewRow] = useState(null);          // 추가 행 (null이면 숨김)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef(null);

  const load = useCallback(() => {
    finishingAPI.getAll().then(r => setItems(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // 추가 행 열기
  const openNew = () => {
    setEditingId(null);
    setNewRow({ ...EMPTY_NEW });
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  // 수정 시작
  const startEdit = (item) => {
    setNewRow(null);
    setEditingId(item.id);
    setEditForm({ name: item.name, unit_type: item.unit_type, unit_price: String(item.unit_price) });
  };

  // 수정 저장
  const saveEdit = async () => {
    if (!editForm.name.trim() || editForm.unit_price === '' || isNaN(Number(editForm.unit_price))) return;
    setSaving(true);
    try {
      await finishingAPI.update(editingId, {
        name: editForm.name.trim(),
        unit_type: editForm.unit_type,
        unit_price: Number(editForm.unit_price),
      });
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  // 추가 저장
  const saveNew = async () => {
    if (!newRow.name.trim() || newRow.unit_price === '' || isNaN(Number(newRow.unit_price))) return;
    setSaving(true);
    try {
      await finishingAPI.create({
        name: newRow.name.trim(),
        unit_type: newRow.unit_type,
        unit_price: Number(newRow.unit_price),
      });
      setNewRow(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await finishingAPI.delete(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  const fmt = (n) => Number(n).toLocaleString('ko-KR');

  const editKeyDown = (e, saveFn, cancelFn) => {
    if (e.key === 'Enter') saveFn();
    if (e.key === 'Escape') cancelFn();
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>후가공 옵션 관리</h2>
          <button className="btn btn-primary" onClick={openNew} disabled={!!newRow}>+ 후가공 추가</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>후가공명</th>
                  <th>단위 방식</th>
                  <th className="text-right">기본 단가</th>
                  <th className="text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !newRow && (
                  <tr><td colSpan={4} className="table-empty">등록된 후가공이 없습니다.</td></tr>
                )}
                {items.map(item =>
                  editingId === item.id ? (
                    /* ── 수정 행 ── */
                    <tr key={item.id} style={{ background: '#eff6ff' }}>
                      <td>
                        <input
                          className="form-control"
                          style={{ fontSize: '0.85rem' }}
                          value={editForm.name}
                          onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          onKeyDown={e => editKeyDown(e, saveEdit, () => setEditingId(null))}
                          autoFocus
                        />
                      </td>
                      <td>
                        <select
                          className="form-control"
                          style={{ fontSize: '0.85rem' }}
                          value={editForm.unit_type}
                          onChange={e => setEditForm(p => ({ ...p, unit_type: e.target.value }))}
                        >
                          {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-control"
                          style={{ fontSize: '0.85rem', textAlign: 'right' }}
                          type="number" min="0" step="1"
                          value={editForm.unit_price}
                          onChange={e => setEditForm(p => ({ ...p, unit_price: e.target.value }))}
                          onKeyDown={e => editKeyDown(e, saveEdit, () => setEditingId(null))}
                        />
                      </td>
                      <td className="text-center">
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>저장</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>취소</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    /* ── 일반 행 ── */
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td>
                        <span className="badge badge-blue" style={{ fontSize: '0.8rem' }}>
                          {UNIT_TYPE_LABELS[item.unit_type] || item.unit_type}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="amount">{fmt(item.unit_price)}원</span>
                      </td>
                      <td className="text-center">
                        <div className="btn-group" style={{ justifyContent: 'center' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(item)}>수정</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(item)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {/* ── 새 항목 행 ── */}
                {newRow && (
                  <tr style={{ background: '#f0fdf4' }}>
                    <td>
                      <input
                        ref={nameInputRef}
                        className="form-control"
                        style={{ fontSize: '0.85rem' }}
                        placeholder="후가공명"
                        value={newRow.name}
                        onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))}
                        onKeyDown={e => editKeyDown(e, saveNew, () => setNewRow(null))}
                      />
                    </td>
                    <td>
                      <select
                        className="form-control"
                        style={{ fontSize: '0.85rem' }}
                        value={newRow.unit_type}
                        onChange={e => setNewRow(p => ({ ...p, unit_type: e.target.value }))}
                      >
                        {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control"
                        style={{ fontSize: '0.85rem', textAlign: 'right' }}
                        type="number" min="0" step="1"
                        placeholder="단가"
                        value={newRow.unit_price}
                        onChange={e => setNewRow(p => ({ ...p, unit_price: e.target.value }))}
                        onKeyDown={e => editKeyDown(e, saveNew, () => setNewRow(null))}
                      />
                    </td>
                    <td className="text-center">
                      <div className="btn-group" style={{ justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveNew} disabled={saving}>추가</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setNewRow(null)}>취소</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--gray-200)', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
          수정 행에서 Enter로 저장, Esc로 취소 가능합니다.
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>후가공 삭제</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                <strong>{deleteTarget.name}</strong>을(를) 삭제하시겠습니까?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>취소</button>
              <button className="btn btn-danger" onClick={handleDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
