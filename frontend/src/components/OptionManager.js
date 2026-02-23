import React, { useEffect, useState } from 'react';

export default function OptionManager() {
  const [items, setItems] = useState([]);
  const [label, setLabel] = useState('');
  const [priceDelta, setPriceDelta] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const res = await fetch('/api/options');
      if (!res.ok) throw new Error('옵션 조회 실패');
      const data = await res.json();
      setItems(data);
    } catch (e) {
      setErr(e.message || '오류 발생');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!label.trim()) return;
    const delta = priceDelta === '' ? 0 : Number(priceDelta);
    if (Number.isNaN(delta)) {
      setErr('추가금액은 숫자로 입력하세요');
      return;
    }

    try {
      setErr('');
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), price_delta: delta }),
      });
      if (!res.ok) throw new Error('옵션 추가 실패');
      setLabel('');
      setPriceDelta('');
      await load();
    } catch (e) {
      setErr(e.message || '오류 발생');
    }
  }

  async function remove(id) {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      setErr('');
      const res = await fetch(`/api/options/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('옵션 삭제 실패');
      await load();
    } catch (e) {
      setErr(e.message || '오류 발생');
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>옵션 관리</h2>

      {err && <div style={{ color: 'red' }}>{err}</div>}

      <div style={{ marginBottom: 10 }}>
        <input
          placeholder="옵션명 입력"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          placeholder="추가금액"
          value={priceDelta}
          onChange={(e) => setPriceDelta(e.target.value)}
          style={{ marginLeft: 8 }}
        />
        <button onClick={add} style={{ marginLeft: 8 }}>
          추가
        </button>
      </div>

      {loading ? (
        <div>불러오는 중...</div>
      ) : (
        <table border="1" cellPadding="5">
          <thead>
            <tr>
              <th>ID</th>
              <th>옵션명</th>
              <th>추가금액</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="4">옵션이 없습니다.</td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.label}</td>
                  <td>{Number(it.price_delta || 0).toLocaleString()}원</td>
                  <td>
                    <button onClick={() => remove(it.id)}>삭제</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}