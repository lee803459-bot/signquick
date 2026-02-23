import React, { useEffect, useState } from 'react';

export default function CategoryManager() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setErr('');
      setLoading(true);
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('카테고리 조회 실패');
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
    if (!name.trim()) return;
    try {
      setErr('');
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error('카테고리 추가 실패');
      setName('');
      await load();
    } catch (e) {
      setErr(e.message || '오류 발생');
    }
  }

  async function remove(id) {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try {
      setErr('');
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('카테고리 삭제 실패');
      await load();
    } catch (e) {
      setErr(e.message || '오류 발생');
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>카테고리 관리</h2>

      {err && <div style={{ color: 'red' }}>{err}</div>}

      <div style={{ marginBottom: 10 }}>
        <input
          placeholder="카테고리명 입력"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
              <th>카테고리명</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="3">카테고리가 없습니다.</td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.name}</td>
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