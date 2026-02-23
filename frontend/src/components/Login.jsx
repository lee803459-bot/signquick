import React, { useState } from 'react';
import { authAPI } from '../api';

export default function Login({ onLogin }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setError('');
  };

  const switchTab = (t) => {
    setTab(t);
    setForm({ username: '', password: '', confirmPassword: '' });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (tab === 'register' && form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);
    try {
      const payload = { username: form.username.trim(), password: form.password };
      const res = tab === 'login'
        ? await authAPI.login(payload)
        : await authAPI.register(payload);
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 1rem' }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', color: 'white' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
            사인퀵 <span style={{ fontWeight: 400, opacity: 0.8 }}>SignQuick</span>
          </div>
          <div style={{ marginTop: '0.4rem', opacity: 0.7, fontSize: '0.9rem' }}>간판 견적 관리 시스템</div>
        </div>

        {/* 카드 */}
        <div className="card" style={{ margin: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          {/* 탭 */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)' }}>
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  border: 'none',
                  background: 'transparent',
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? 'var(--primary)' : 'var(--gray-400)',
                  borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">아이디</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={form.username}
                  onChange={set('username')}
                  autoFocus
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </div>

              {tab === 'register' && (
                <div className="form-group">
                  <label className="form-label">비밀번호 확인</label>
                  <input
                    className="form-control"
                    type="password"
                    placeholder="비밀번호를 다시 입력하세요"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}

              {error && (
                <div className="alert-error" style={{ marginBottom: '1rem', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                disabled={loading}
              >
                {loading ? '처리 중...' : tab === 'login' ? '로그인' : '가입하기'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
