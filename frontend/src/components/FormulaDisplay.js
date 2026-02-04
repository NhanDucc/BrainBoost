import React from 'react';
import 'mathlive';

const FormulaDisplay = ({ content }) => {
  if (!content) return null;

  // Chuyển về string để tránh lỗi nếu null/undefined
  const textContent = String(content);

  // Tách chuỗi dựa trên dấu $. 
  // Regex này giữ lại dấu $ để ta biết đâu là formula
  const parts = textContent.split(/(\$[^$]+\$)/g);

  return (
    <span className="formula-display-container" style={{ fontSize: '1.05em', lineHeight: '1.6' }}>
      {parts.map((part, index) => {
        // Kiểm tra nếu là công thức (kẹp giữa $)
        if (part.startsWith('$') && part.endsWith('$')) {
          const latex = part.slice(1, -1); // Bỏ 2 dấu $
          return (
            <math-field
              key={index}
              read-only
              style={{
                display: 'inline-block',
                verticalAlign: '-3px', // Căn chỉnh cho thẳng hàng với dòng kẻ
                border: 'none',       // Bỏ viền input
                background: 'transparent', // Nền trong suốt
                boxShadow: 'none',    // Bỏ đổ bóng
                margin: '0 2px',
                padding: '0',
                color: 'inherit',      // Màu chữ theo văn bản mẹ
                cursor: 'default',
                pointerEvents: 'none'  // Ngăn người dùng click vào
              }}
            >
              {latex}
            </math-field>
          );
        }

        // Nếu là văn bản thường: Xử lý xuống dòng (\n)
        return (
          <span key={index}>
            {part.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>
                {line}
                {/* Nếu không phải dòng cuối thì thêm thẻ xuống dòng */}
                {i < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        );
      })}
    </span>
  );
};

export default FormulaDisplay;