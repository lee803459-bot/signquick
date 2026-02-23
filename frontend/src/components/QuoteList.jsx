import React, { useState, useEffect, useCallback } from 'react';
import { quoteAPI } from '../api';
import QuoteDocument from './QuoteDocument';

export default function QuoteList() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await quoteAPI.getAll();
      setQuotes(res.data);
    } catch {
      setError('견적서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const viewQuote = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await quoteAPI.getOne(id);
      setSelectedQuote(res.data);
    } catch {
      alert('견적서를 불러오는데 실패했습니다.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await quoteAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedQuote?.id === deleteTarget.id) setSelectedQuote(null);
      fetchQuotes();
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  const fmt = (n) => Number(n).toLocaleString('ko-KR');
  const fmtDate = (str) => {
    const d = new Date(str);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  };

  if (selectedQuote) {
    return (
      <div>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <h2>견적서 상세 — {selectedQuote.quote_number}</h2>
            <button className="btn btn-secondary" onClick={() => setSelectedQuote(null)}>
              ← 목록으로
            </button>
          </div>
        </div>
        <QuoteDocument quote={selectedQuote} />
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>견적서 목록</h2>
          <button className="btn btn-secondary btn-sm" onClick={fetchQuotes}>
            새로고침
          </button>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-error">{error}</div>}

          {loading || loadingDetail ? (
            <div className="loading">불러오는 중...</div>
          ) : quotes.length === 0 ? (
            <div className="table-empty" style={{ padding: '3rem 1rem' }}>
              저장된 견적서가 없습니다.<br />
              <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                견적서 작성 탭에서 견적서를 작성하고 저장하세요.
              </span>
            </div>
          ) : (
            <div className="quote-cards">
              {quotes.map(q => (
                <div key={q.id} className="quote-card">
                  <div className="quote-card-info">
                    <div className="quote-card-number">{q.quote_number}</div>
                    <div className="quote-card-vendor">
                      {q.is_sign_quote && (
                        <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', padding: '1px 6px', marginRight: '6px', fontWeight: 600 }}>고객명</span>
                      )}
                      {q.vendor_name}
                    </div>
                    <div className="quote-card-meta">
                      {fmtDate(q.created_at)}
                      {q.note && ` · ${q.note}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div className="quote-card-amount">
                      {fmt(q.is_sign_quote ? q.total_with_vat : q.total_amount)}원
                    </div>
                    {q.is_sign_quote && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                        공급가 {fmt(q.total_amount)}원 + VAT {fmt(q.vat_amount)}원
                      </div>
                    )}
                    <div className="btn-group">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => viewQuote(q.id)}
                      >
                        상세 / 내보내기
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(q)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {quotes.length > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              총 {quotes.length}건의 견적서
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>견적서 삭제</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                <strong>{deleteTarget.quote_number}</strong> ({deleteTarget.vendor_name}) 견적서를 삭제하시겠습니까?<br />
                <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                  이 작업은 되돌릴 수 없습니다.
                </span>
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
