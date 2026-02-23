# 견적서 관리 시스템

React + Node.js + SQLite 기반 견적서 관리 웹 애플리케이션

## 기능

- **단가표 관리**: 거래처별 제품/규격/단가 등록·수정·삭제
- **견적서 자동 생성**: 거래처·제품 선택 후 수량 입력 → 자동 합계 계산
- **PDF 내보내기**: 견적서를 PDF 파일로 다운로드
- **엑셀 내보내기**: 견적서를 Excel(.xlsx) 파일로 다운로드
- **반응형 디자인**: 모바일/태블릿/데스크톱 모두 지원

## 실행 방법

### 1. 백엔드 실행

```bash
cd backend
npm install
npm start
# → http://localhost:3001 에서 실행
```

### 2. 프론트엔드 실행 (새 터미널)

```bash
cd frontend
npm install
npm start
# → http://localhost:3000 에서 실행
```

## 프로젝트 구조

```
myproject/
├── backend/
│   ├── package.json
│   ├── server.js       # Express API 서버
│   ├── db.js           # SQLite 초기화
│   └── quotes.db       # SQLite DB (자동 생성)
└── frontend/
    ├── package.json
    └── src/
        ├── App.js
        ├── App.css
        ├── api.js
        └── components/
            ├── PriceTable.jsx    # 단가표 관리
            ├── QuoteCreate.jsx   # 견적서 작성
            ├── QuoteList.jsx     # 견적서 목록
            └── QuoteDocument.jsx # 견적서 미리보기 & 내보내기
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/prices | 단가 목록 조회 |
| POST | /api/prices | 단가 추가 |
| PUT | /api/prices/:id | 단가 수정 |
| DELETE | /api/prices/:id | 단가 삭제 |
| GET | /api/vendors | 거래처 목록 |
| GET | /api/quotes | 견적서 목록 |
| GET | /api/quotes/:id | 견적서 상세 |
| POST | /api/quotes | 견적서 저장 |
| DELETE | /api/quotes/:id | 견적서 삭제 |
