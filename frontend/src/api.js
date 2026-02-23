import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL + '/api' : '/api';
const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sq_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    // 인증 라우트(/auth/*)는 인터셉터 제외 — 로그인/회원가입 실패 시 폼에 에러 표시
    const isAuthRoute = err.config?.url?.startsWith('/auth/');
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('sq_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const priceAPI = {
  getAll: (params) => api.get('/prices', { params }),
  create: (data) => api.post('/prices', data),
  update: (id, data) => api.put(`/prices/${id}`, data),
  delete: (id) => api.delete(`/prices/${id}`),
  getVendors: () => api.get('/vendors'),
};

export const quoteAPI = {
  getAll: () => api.get('/quotes'),
  getOne: (id) => api.get(`/quotes/${id}`),
  create: (data) => api.post('/quotes', data),
  delete: (id) => api.delete(`/quotes/${id}`),
};

export const categoryAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const optionAPI = {
  getAll: () => api.get('/options'),
  getByCategoryId: (categoryId) => api.get(`/options/category/${categoryId}`),
  create: (data) => api.post('/options', data),
  delete: (id) => api.delete(`/options/${id}`),
};

export const signCategoryAPI = {
  getAll: () => api.get('/sign-categories'),
  create: (data) => api.post('/sign-categories', data),
  update: (id, data) => api.put(`/sign-categories/${id}`, data),
  delete: (id) => api.delete(`/sign-categories/${id}`),
};

export const signSubcategoryAPI = {
  getAll: (categoryId) => api.get('/sign-subcategories', { params: { categoryId } }),
  create: (data) => api.post('/sign-subcategories', data),
  update: (id, data) => api.put(`/sign-subcategories/${id}`, data),
  delete: (id) => api.delete(`/sign-subcategories/${id}`),
};

export const signMaterialAPI = {
  getAll: (subcategoryId) => api.get('/sign-materials', { params: { subcategoryId } }),
  create: (data) => api.post('/sign-materials', data),
  update: (id, data) => api.put(`/sign-materials/${id}`, data),
  delete: (id) => api.delete(`/sign-materials/${id}`),
  bulkImport: (data) => api.post('/sign-materials/bulk-import', data),
};

export const finishingAPI = {
  getAll: () => api.get('/finishing-options'),
  create: (data) => api.post('/finishing-options', data),
  update: (id, data) => api.put(`/finishing-options/${id}`, data),
  delete: (id) => api.delete(`/finishing-options/${id}`),
};
