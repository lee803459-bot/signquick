import React, { useState, useEffect } from 'react';
import './App.css';
import { authAPI } from './api';
import Login from './components/Login';
import QuoteList from './components/QuoteList';
import SignPriceManager from './components/SignPriceManager';
import FinishingManager from './components/FinishingManager';
import SignQuoteCreate from './components/SignQuoteCreate';

const TABS = [
  { key: 'sign-prices',    label: '🪧 간판 단가표' },
  { key: 'finishing',      label: '🔧 후가공 관리' },
  { key: 'sign-create',    label: '✏️ 간판 견적서' },
  { key: 'list',           label: '📁 견적서 목록' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('sign-prices');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sq_token');
    if (!token) { setAuthLoading(false); return; }
    authAPI.me()
      .then(r => setUser(r.data))
      .catch(() => localStorage.removeItem('sq_token'))
      .finally(() => setAuthLoading(false));
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('sq_token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('sq_token');
    setUser(null);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
        로딩 중...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">
            사인퀵 <span>SignQuick</span>
          </div>
          <nav>
            <ul className="nav-tabs">
              {TABS.map(tab =>
                tab.label === null ? (
                  <li key={tab.key} style={{ width: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 8px', alignSelf: 'stretch' }} />
                ) : (
                  <li
                    key={tab.key}
                    className={`nav-tab${activeTab === tab.key ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </li>
                )
              )}
            </ul>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            <span>{user.username} 님</span>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {activeTab === 'sign-prices' && <SignPriceManager />}
        {activeTab === 'finishing'   && <FinishingManager />}
        {activeTab === 'sign-create' && <SignQuoteCreate onSaved={() => setActiveTab('list')} />}
        {activeTab === 'list'        && <QuoteList />}
      </main>
    </div>
  );
}
