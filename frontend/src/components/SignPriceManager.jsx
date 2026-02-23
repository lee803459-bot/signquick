import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { signCategoryAPI, signSubcategoryAPI, signMaterialAPI } from '../api';

const CALC_TYPE_LABELS = {
  m2: 'm²당',
  unit: '개당/건당',
  char: '글자당',
};

const CALC_TYPE_COLORS = {
  m2:   { bg: '#dbeafe', color: '#1e40af' },
  char: { bg: '#fef3c7', color: '#92400e' },
  unit: { bg: '#d1fae5', color: '#065f46' },
};

const EMPTY_MAT = { name: '', calc_type: 'unit', unit_price: '', note: '' };

export default function SignPriceManager() {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [materials, setMaterials] = useState([]);

  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedSubId, setSelectedSubId] = useState(null);

  // 대분류 편집
  const [catInput, setCatInput] = useState('');
  const [catEditId, setCatEditId] = useState(null);
  const [catEditName, setCatEditName] = useState('');

  // 중분류 편집
  const [subInput, setSubInput] = useState('');
  const [subEditId, setSubEditId] = useState(null);
  const [subEditName, setSubEditName] = useState('');

  // 소재 인라인 편집
  const [matEditingId, setMatEditingId] = useState(null);
  const [matEditForm, setMatEditForm] = useState(EMPTY_MAT);
  const [matNewRow, setMatNewRow] = useState(null);
  const matNameRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null); // { type, item }

  // 엑셀 일괄 등록
  const [importModal, setImportModal] = useState(null); // null | { rows }
  const [importing, setImporting] = useState(false);
  const xlsxFileRef = useRef(null);

  const loadCategories = useCallback(() => {
    signCategoryAPI.getAll().then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const loadSubcategories = useCallback((catId) => {
    if (!catId) { setSubcategories([]); setSelectedSubId(null); return; }
    signSubcategoryAPI.getAll(catId).then(r => setSubcategories(r.data)).catch(() => {});
  }, []);

  const loadMaterials = useCallback((subId) => {
    if (!subId) { setMaterials([]); return; }
    signMaterialAPI.getAll(subId).then(r => setMaterials(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { loadSubcategories(selectedCatId); setSelectedSubId(null); }, [selectedCatId, loadSubcategories]);
  useEffect(() => { loadMaterials(selectedSubId); }, [selectedSubId, loadMaterials]);

  // ── 대분류 ──────────────────────────────────────────────────
  const addCategory = async () => {
    if (!catInput.trim()) return;
    await signCategoryAPI.create({ name: catInput.trim() });
    setCatInput('');
    loadCategories();
  };

  const saveEditCat = async (id) => {
    if (!catEditName.trim()) return;
    await signCategoryAPI.update(id, { name: catEditName.trim() });
    setCatEditId(null);
    loadCategories();
  };

  const deleteCategory = async () => {
    if (!deleteTarget) return;
    await signCategoryAPI.delete(deleteTarget.item.id);
    setDeleteTarget(null);
    if (selectedCatId === deleteTarget.item.id) setSelectedCatId(null);
    loadCategories();
  };

  // ── 중분류 ──────────────────────────────────────────────────
  const addSubcategory = async () => {
    if (!subInput.trim() || !selectedCatId) return;
    await signSubcategoryAPI.create({ name: subInput.trim(), category_id: selectedCatId });
    setSubInput('');
    loadSubcategories(selectedCatId);
  };

  const saveEditSub = async (id) => {
    if (!subEditName.trim()) return;
    await signSubcategoryAPI.update(id, { name: subEditName.trim() });
    setSubEditId(null);
    loadSubcategories(selectedCatId);
  };

  const deleteSubcategory = async () => {
    if (!deleteTarget) return;
    await signSubcategoryAPI.delete(deleteTarget.item.id);
    setDeleteTarget(null);
    if (selectedSubId === deleteTarget.item.id) setSelectedSubId(null);
    loadSubcategories(selectedCatId);
  };

  // ── 소재 ────────────────────────────────────────────────────
  const openNewMat = () => {
    setMatEditingId(null);
    setMatNewRow({ ...EMPTY_MAT });
    setTimeout(() => matNameRef.current?.focus(), 50);
  };

  // 중분류 변경 시 새 행/편집 행 초기화
  useEffect(() => { setMatEditingId(null); setMatNewRow(null); }, [selectedSubId]);

  const startEditMat = (mat) => {
    setMatNewRow(null);
    setMatEditingId(mat.id);
    setMatEditForm({ name: mat.name, calc_type: mat.calc_type, unit_price: String(mat.unit_price), note: mat.note || '' });
  };

  const saveEditMat = async () => {
    if (!matEditForm.name.trim() || matEditForm.unit_price === '' || isNaN(Number(matEditForm.unit_price))) return;
    await signMaterialAPI.update(matEditingId, {
      name: matEditForm.name.trim(),
      calc_type: matEditForm.calc_type,
      unit_price: Number(matEditForm.unit_price),
      note: matEditForm.note,
    });
    setMatEditingId(null);
    loadMaterials(selectedSubId);
  };

  const saveNewMat = async () => {
    if (!matNewRow.name.trim() || matNewRow.unit_price === '' || isNaN(Number(matNewRow.unit_price))) return;
    await signMaterialAPI.create({
      subcategory_id: selectedSubId,
      name: matNewRow.name.trim(),
      calc_type: matNewRow.calc_type,
      unit_price: Number(matNewRow.unit_price),
      note: matNewRow.note,
    });
    setMatNewRow(null);
    loadMaterials(selectedSubId);
  };

  const matKeyDown = (e, saveFn, cancelFn) => {
    if (e.key === 'Enter') saveFn();
    if (e.key === 'Escape') cancelFn();
  };

  const deleteMaterial = async () => {
    if (!deleteTarget) return;
    await signMaterialAPI.delete(deleteTarget.item.id);
    setDeleteTarget(null);
    loadMaterials(selectedSubId);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'category') deleteCategory();
    else if (deleteTarget.type === 'subcategory') deleteSubcategory();
    else if (deleteTarget.type === 'material') deleteMaterial();
  };

  const fmt = (n) => Number(n).toLocaleString('ko-KR');

  // ── 엑셀 일괄 등록 ───────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['대분류', '중분류', '소재명', '계산방식', '단가', '비고'],
      ['LED간판', '채널간판', '알루미늄 채널', 'm2', '50000', ''],
      ['LED간판', '채널간판', '스텐 채널', 'm2', '80000', '고급형'],
      ['현수막', '옥외현수막', '일반 현수막', 'm2', '3000', ''],
    ]);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '간판단가표');
    XLSX.writeFile(wb, '간판단가표_템플릿.xlsx');
  };

  const handleXlsxUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { alert('데이터가 없습니다. 템플릿을 확인하세요.'); return; }
        const data = rows.slice(1)
          .filter(row => row.some(cell => String(cell).trim()))
          .map((row, idx) => ({
            rowNum: idx + 2,
            category_name: String(row[0] || '').trim(),
            subcategory_name: String(row[1] || '').trim(),
            name: String(row[2] || '').trim(),
            calc_type: String(row[3] || 'unit').trim().toLowerCase(),
            unit_price: String(row[4] || '').trim(),
            note: String(row[5] || '').trim(),
          }));
        if (data.length === 0) { alert('유효한 데이터 행이 없습니다.'); return; }
        setImportModal({ rows: data });
      } catch {
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkImport = async () => {
    if (!importModal?.rows?.length) return;
    setImporting(true);
    try {
      const res = await signMaterialAPI.bulkImport({ items: importModal.rows });
      const { success, errors } = res.data;
      let msg = `${success}개 항목이 등록되었습니다.`;
      if (errors.length > 0) msg += `\n\n오류 (${errors.length}건):\n${errors.join('\n')}`;
      alert(msg);
      setImportModal(null);
      loadCategories();
      if (selectedCatId) loadSubcategories(selectedCatId);
      if (selectedSubId) loadMaterials(selectedSubId);
    } catch {
      alert('가져오기 중 오류가 발생했습니다.');
    } finally {
      setImporting(false);
    }
  };

  const importRowValid = (row) =>
    row.category_name && row.subcategory_name && row.name && row.unit_price !== '' && !isNaN(Number(row.unit_price));

  return (
    <div>
      {/* ── 엑셀 툴바 ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          ↓ 템플릿 다운로드
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => xlsxFileRef.current?.click()}>
          ↑ 엑셀 일괄 등록
        </button>
        <input
          ref={xlsxFileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleXlsxUpload}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 220px 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* ── 대분류 패널 ── */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ padding: '0.75rem 1rem' }}>
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>대분류</h3>
          </div>
          <div className="card-body" style={{ padding: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <input
                className="form-control"
                style={{ fontSize: '0.85rem' }}
                placeholder="대분류 추가..."
                value={catInput}
                onChange={e => setCatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
              />
              <button className="btn btn-primary btn-sm" onClick={addCategory}>+</button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {categories.map(cat => (
                <li key={cat.id}>
                  {catEditId === cat.id ? (
                    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.3rem' }}>
                      <input
                        className="form-control"
                        style={{ fontSize: '0.8rem' }}
                        value={catEditName}
                        onChange={e => setCatEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEditCat(cat.id)}
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => saveEditCat(cat.id)}>저장</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setCatEditId(null)}>✕</button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.4rem 0.5rem', marginBottom: '0.2rem', borderRadius: '6px',
                        cursor: 'pointer',
                        background: selectedCatId === cat.id ? 'var(--primary)' : 'transparent',
                        color: selectedCatId === cat.id ? 'white' : 'inherit',
                      }}
                      onClick={() => setSelectedCatId(cat.id === selectedCatId ? null : cat.id)}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: selectedCatId === cat.id ? 600 : 400 }}>{cat.name}</span>
                      <div style={{ display: 'flex', gap: '0.2rem' }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-sm"
                          style={{ padding: '1px 6px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: selectedCatId === cat.id ? 'rgba(255,255,255,0.8)' : 'var(--gray-400)' }}
                          onClick={() => { setCatEditId(cat.id); setCatEditName(cat.name); }}
                        >✎</button>
                        <button
                          className="btn btn-sm"
                          style={{ padding: '1px 6px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: selectedCatId === cat.id ? 'rgba(255,255,255,0.8)' : 'var(--danger)' }}
                          onClick={() => setDeleteTarget({ type: 'category', item: cat })}
                        >✕</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {categories.length === 0 && <li style={{ fontSize: '0.8rem', color: 'var(--gray-400)', textAlign: 'center', padding: '1rem' }}>없음</li>}
            </ul>
          </div>
        </div>

        {/* ── 중분류 패널 ── */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header" style={{ padding: '0.75rem 1rem' }}>
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>중분류</h3>
          </div>
          <div className="card-body" style={{ padding: '0.75rem' }}>
            {!selectedCatId ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', textAlign: 'center' }}>← 대분류 선택</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <input
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                    placeholder="중분류 추가..."
                    value={subInput}
                    onChange={e => setSubInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubcategory()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={addSubcategory}>+</button>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {subcategories.map(sub => (
                    <li key={sub.id}>
                      {subEditId === sub.id ? (
                        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.3rem' }}>
                          <input
                            className="form-control"
                            style={{ fontSize: '0.8rem' }}
                            value={subEditName}
                            onChange={e => setSubEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveEditSub(sub.id)}
                            autoFocus
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => saveEditSub(sub.id)}>저장</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSubEditId(null)}>✕</button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.4rem 0.5rem', marginBottom: '0.2rem', borderRadius: '6px',
                            cursor: 'pointer',
                            background: selectedSubId === sub.id ? '#dbeafe' : 'transparent',
                            color: selectedSubId === sub.id ? '#1e40af' : 'inherit',
                          }}
                          onClick={() => setSelectedSubId(sub.id === selectedSubId ? null : sub.id)}
                        >
                          <span style={{ fontSize: '0.85rem', fontWeight: selectedSubId === sub.id ? 600 : 400 }}>{sub.name}</span>
                          <div style={{ display: 'flex', gap: '0.2rem' }} onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '1px 6px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--gray-400)' }}
                              onClick={() => { setSubEditId(sub.id); setSubEditName(sub.name); }}
                            >✎</button>
                            <button
                              className="btn btn-sm"
                              style={{ padding: '1px 6px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: 'var(--danger)' }}
                              onClick={() => setDeleteTarget({ type: 'subcategory', item: sub })}
                            >✕</button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                  {subcategories.length === 0 && <li style={{ fontSize: '0.8rem', color: 'var(--gray-400)', textAlign: 'center', padding: '1rem' }}>없음</li>}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ── 소재/단가 패널 ── */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>
              소재 &amp; 단가
              {selectedSubId && (
                <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: 'var(--gray-500)' }}>
                  — {subcategories.find(s => s.id === selectedSubId)?.name}
                </span>
              )}
            </h3>
            {selectedSubId && (
              <button className="btn btn-primary btn-sm" onClick={openNewMat} disabled={!!matNewRow}>+ 소재 추가</button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!selectedSubId ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.9rem' }}>
                ← 대분류 → 중분류를 선택하면<br />소재별 단가를 관리할 수 있습니다.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>소재명</th>
                      <th>계산방식</th>
                      <th className="text-right">단가</th>
                      <th>비고</th>
                      <th className="text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 && !matNewRow && (
                      <tr><td colSpan={5} className="table-empty">등록된 소재가 없습니다.</td></tr>
                    )}
                    {materials.map(mat =>
                      matEditingId === mat.id ? (
                        /* ── 수정 행 ── */
                        <tr key={mat.id} style={{ background: '#eff6ff' }}>
                          <td>
                            <input
                              className="form-control"
                              style={{ fontSize: '0.85rem' }}
                              value={matEditForm.name}
                              onChange={e => setMatEditForm(p => ({ ...p, name: e.target.value }))}
                              onKeyDown={e => matKeyDown(e, saveEditMat, () => setMatEditingId(null))}
                              autoFocus
                            />
                          </td>
                          <td>
                            <select
                              className="form-control"
                              style={{ fontSize: '0.85rem' }}
                              value={matEditForm.calc_type}
                              onChange={e => setMatEditForm(p => ({ ...p, calc_type: e.target.value }))}
                            >
                              {Object.entries(CALC_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-control"
                              style={{ fontSize: '0.85rem', textAlign: 'right' }}
                              type="number" min="0" step="1"
                              value={matEditForm.unit_price}
                              onChange={e => setMatEditForm(p => ({ ...p, unit_price: e.target.value }))}
                              onKeyDown={e => matKeyDown(e, saveEditMat, () => setMatEditingId(null))}
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              style={{ fontSize: '0.85rem' }}
                              value={matEditForm.note}
                              onChange={e => setMatEditForm(p => ({ ...p, note: e.target.value }))}
                              onKeyDown={e => matKeyDown(e, saveEditMat, () => setMatEditingId(null))}
                              placeholder="비고"
                            />
                          </td>
                          <td className="text-center">
                            <div className="btn-group" style={{ justifyContent: 'center' }}>
                              <button className="btn btn-primary btn-sm" onClick={saveEditMat}>저장</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setMatEditingId(null)}>취소</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        /* ── 일반 행 ── */
                        <tr key={mat.id}>
                          <td style={{ fontWeight: 500 }}>{mat.name}</td>
                          <td>
                            <span className="badge" style={{ ...CALC_TYPE_COLORS[mat.calc_type], fontSize: '0.75rem' }}>
                              {CALC_TYPE_LABELS[mat.calc_type]}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="amount">{fmt(mat.unit_price)}원</span>
                          </td>
                          <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{mat.note || '—'}</td>
                          <td className="text-center">
                            <div className="btn-group" style={{ justifyContent: 'center' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => startEditMat(mat)}>수정</button>
                              <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget({ type: 'material', item: mat })}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}

                    {/* ── 새 소재 행 ── */}
                    {matNewRow && (
                      <tr style={{ background: '#f0fdf4' }}>
                        <td>
                          <input
                            ref={matNameRef}
                            className="form-control"
                            style={{ fontSize: '0.85rem' }}
                            placeholder="소재명"
                            value={matNewRow.name}
                            onChange={e => setMatNewRow(p => ({ ...p, name: e.target.value }))}
                            onKeyDown={e => matKeyDown(e, saveNewMat, () => setMatNewRow(null))}
                          />
                        </td>
                        <td>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.85rem' }}
                            value={matNewRow.calc_type}
                            onChange={e => setMatNewRow(p => ({ ...p, calc_type: e.target.value }))}
                          >
                            {Object.entries(CALC_TYPE_LABELS).map(([k, v]) => (
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
                            value={matNewRow.unit_price}
                            onChange={e => setMatNewRow(p => ({ ...p, unit_price: e.target.value }))}
                            onKeyDown={e => matKeyDown(e, saveNewMat, () => setMatNewRow(null))}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            style={{ fontSize: '0.85rem' }}
                            placeholder="비고 (선택)"
                            value={matNewRow.note}
                            onChange={e => setMatNewRow(p => ({ ...p, note: e.target.value }))}
                            onKeyDown={e => matKeyDown(e, saveNewMat, () => setMatNewRow(null))}
                          />
                        </td>
                        <td className="text-center">
                          <div className="btn-group" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-primary btn-sm" onClick={saveNewMat}>추가</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setMatNewRow(null)}>취소</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 엑셀 미리보기 모달 */}
      {importModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportModal(null)}>
          <div className="modal" style={{ maxWidth: '800px', width: '95vw' }}>
            <div className="modal-header">
              <h3>엑셀 일괄 등록 미리보기</h3>
              <button className="modal-close" onClick={() => setImportModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                총 {importModal.rows.length}행 |&nbsp;
                <span style={{ color: 'var(--success)' }}>유효 {importModal.rows.filter(importRowValid).length}건</span>
                {importModal.rows.filter(r => !importRowValid(r)).length > 0 && (
                  <span style={{ color: 'var(--danger)' }}>&nbsp;/ 오류 {importModal.rows.filter(r => !importRowValid(r)).length}건 (오류 행은 건너뜀)</span>
                )}
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>행</th>
                      <th>대분류</th>
                      <th>중분류</th>
                      <th>소재명</th>
                      <th>계산방식</th>
                      <th className="text-right">단가</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importModal.rows.map((row) => {
                      const valid = importRowValid(row);
                      const rowStyle = valid ? {} : { background: '#fff5f5', color: '#c53030' };
                      const ct = ['m2', 'unit', 'char'].includes(row.calc_type) ? row.calc_type : 'unit';
                      return (
                        <tr key={row.rowNum} style={rowStyle}>
                          <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>{row.rowNum}</td>
                          <td>{row.category_name || <span style={{ color: 'var(--danger)' }}>없음</span>}</td>
                          <td>{row.subcategory_name || <span style={{ color: 'var(--danger)' }}>없음</span>}</td>
                          <td>{row.name || <span style={{ color: 'var(--danger)' }}>없음</span>}</td>
                          <td>
                            <span className="badge" style={{ ...(CALC_TYPE_COLORS[ct] || {}), fontSize: '0.72rem' }}>
                              {CALC_TYPE_LABELS[ct] || row.calc_type}
                            </span>
                          </td>
                          <td className="text-right">
                            {row.unit_price !== '' && !isNaN(Number(row.unit_price))
                              ? fmt(row.unit_price) + '원'
                              : <span style={{ color: 'var(--danger)' }}>오류</span>}
                          </td>
                          <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{row.note || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setImportModal(null)}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleBulkImport}
                disabled={importing || importModal.rows.filter(importRowValid).length === 0}
              >
                {importing ? '등록 중...' : `등록 (${importModal.rows.filter(importRowValid).length}건)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>삭제 확인</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                <strong>{deleteTarget.item.name}</strong>을(를) 삭제하시겠습니까?
                {deleteTarget.type !== 'material' && (
                  <><br /><span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>하위 항목이 모두 삭제됩니다.</span></>
                )}
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
