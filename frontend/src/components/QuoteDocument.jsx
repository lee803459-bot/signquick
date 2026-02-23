import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const fmt = (n) => Number(n).toLocaleString('ko-KR');

const fmtDate = (str) => {
  const d = new Date(str);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

export default function QuoteDocument({ quote }) {
  const printRef = useRef(null);

  const exportPDF = async () => {
    const el = printRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      const x = (pageW - imgW) / 2;
      const y = 10;

      if (imgH > pageH - 20) {
        // 내용이 길면 여러 페이지로 분할
        let remaining = imgH;
        let srcY = 0;
        let pageNum = 0;
        while (remaining > 0) {
          if (pageNum > 0) pdf.addPage();
          const sliceH = Math.min(pageH - 20, remaining);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = (sliceH / imgW) * canvas.width;
          const ctx = sliceCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
          pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', x, y, imgW, sliceH);
          srcY += sliceCanvas.height;
          remaining -= sliceH;
          pageNum++;
        }
      } else {
        pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
      }
      pdf.save(`견적서_${quote.quote_number}.pdf`);
    } catch (e) {
      alert('PDF 생성에 실패했습니다: ' + e.message);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 견적서 시트
    const rows = [
      ['견  적  서'],
      [],
      ['견적번호', quote.quote_number, '', '작성일자', fmtDate(quote.created_at)],
      [quote.is_sign_quote ? '고객명' : '거래처명', quote.vendor_name],
      ['비고', quote.note || ''],
      [],
      ['품명', '규격/사이즈', '수량', '단가(원)', '금액(원)'],
      ...quote.items.map(i => [
        i.product_name,
        i.spec || '',
        i.quantity,
        i.unit_price,
        i.total_price,
      ]),
      [],
      ...(quote.is_sign_quote ? [
        ['', '', '', '공급가액', quote.total_amount],
        ['', '', '', '부가세(10%)', quote.vat_amount],
        ['', '', '', '합계(VAT포함)', quote.total_with_vat],
      ] : [
        ['', '', '', '합계', quote.total_amount],
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 22 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 16 },
    ];

    // 제목 병합
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, '견적서');
    XLSX.writeFile(wb, `견적서_${quote.quote_number}.xlsx`);
  };

  return (
    <div>
      {/* 액션 버튼 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ padding: '1rem 1.5rem' }}>
          <div className="btn-group">
            <button className="btn btn-danger btn-lg" onClick={exportPDF}>
              📄 PDF 다운로드
            </button>
            <button className="btn btn-success btn-lg" onClick={exportExcel}>
              📊 엑셀 다운로드
            </button>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
            PDF는 아래 미리보기를 기반으로 생성됩니다.
          </p>
        </div>
      </div>

      {/* 견적서 미리보기 */}
      <div
        ref={printRef}
        style={{
          background: 'white',
          padding: '40px',
          maxWidth: '794px',
          margin: '0 auto',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '900',
            letterSpacing: '12px',
            color: '#1e40af',
            borderBottom: '3px solid #1e40af',
            display: 'inline-block',
            paddingBottom: '6px',
          }}>
            견  적  서
          </h1>
        </div>

        {/* 기본 정보 */}
        <table style={{ width: '100%', marginBottom: '24px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={infoLabelStyle}>견적번호</td>
              <td style={infoValueStyle}>{quote.quote_number}</td>
              <td style={infoLabelStyle}>작성일자</td>
              <td style={infoValueStyle}>{fmtDate(quote.created_at)}</td>
            </tr>
            <tr>
              <td style={infoLabelStyle}>{quote.is_sign_quote ? '고객명' : '거래처명'}</td>
              <td style={{ ...infoValueStyle, fontWeight: '700', fontSize: '15px' }} colSpan={3}>
                {quote.vendor_name}
              </td>
            </tr>
            {quote.note && (
              <tr>
                <td style={infoLabelStyle}>비고</td>
                <td style={infoValueStyle} colSpan={3}>{quote.note}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 품목 테이블 */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead>
            <tr>
              {['품명', '규격/사이즈', '수량', '단가', '금액'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, idx) => (
              <tr key={idx} style={item.is_finishing ? { background: '#fafafa' } : {}}>
                <td style={{ ...tdStyle, color: item.is_finishing ? '#6b7280' : '#1f2937' }}>{item.product_name}</td>
                <td style={{ ...tdStyle, color: '#6b7280' }}>{item.spec || '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{fmt(item.quantity)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: item.is_finishing ? '#374151' : '#1e40af' }}>
                  {fmt(item.total_price)}
                </td>
              </tr>
            ))}
            {/* 빈 행 패딩 */}
            {Array.from({ length: Math.max(0, 5 - quote.items.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                {[0,1,2,3,4].map(j => <td key={j} style={{ ...tdStyle, height: '36px' }}></td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            {quote.is_sign_quote ? (
              <>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', background: '#f8fafc', fontSize: '14px' }}>
                    공급가액
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', background: '#f8fafc' }}>
                    {fmt(quote.total_amount)}원
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', background: '#f8fafc', fontSize: '14px' }}>
                    부가세 (10%)
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', background: '#f8fafc', color: '#6b7280' }}>
                    {fmt(quote.vat_amount)}원
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', background: '#f0f4ff', fontSize: '15px' }}>
                    합  계 (VAT 포함)
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '900', fontSize: '16px', color: '#1e40af', background: '#f0f4ff' }}>
                    {fmt(quote.total_with_vat)}원
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', background: '#f0f4ff', fontSize: '15px' }}>
                  합  계
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '900', fontSize: '16px', color: '#1e40af', background: '#f0f4ff' }}>
                  {fmt(quote.total_amount)}원
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {/* 하단 문구 */}
        <div style={{
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '12px',
          borderTop: '1px solid #e5e7eb',
          paddingTop: '16px',
        }}>
          본 견적서는 견적 기준일로부터 30일간 유효합니다.
        </div>
      </div>
    </div>
  );
}

const infoLabelStyle = {
  padding: '8px 12px',
  background: '#f0f4ff',
  fontWeight: '600',
  fontSize: '13px',
  color: '#374151',
  width: '100px',
  border: '1px solid #dbeafe',
  whiteSpace: 'nowrap',
};

const infoValueStyle = {
  padding: '8px 16px',
  fontSize: '14px',
  color: '#1f2937',
  border: '1px solid #e5e7eb',
};

const thStyle = {
  background: '#1e40af',
  color: 'white',
  padding: '10px 14px',
  fontWeight: '700',
  fontSize: '13px',
  textAlign: 'center',
  border: '1px solid #1e3a8a',
};

const tdStyle = {
  padding: '10px 14px',
  border: '1px solid #e5e7eb',
  fontSize: '14px',
  color: '#1f2937',
};
