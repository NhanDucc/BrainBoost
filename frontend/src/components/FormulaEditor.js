import React, { useEffect, useRef } from 'react';
import 'mathlive';

const FormulaEditor = ({ value, onChange, placeholder = "Type content here..." }) => {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  // --- 1. CẤU HÌNH MENU (Định nghĩa JSON để gán vào Attribute) ---
  const customMenuItems = [
    {
      label: 'Insert Matrix',
      submenu: [
        { label: '2x2 Matrix', command: ['insert', '\\begin{pmatrix}#0&#0\\\\#0&#0\\end{pmatrix}'] },
        { label: '2x1 Vector', command: ['insert', '\\begin{pmatrix}#0\\\\#0\\end{pmatrix}'] },
        { label: '1x2 Vector', command: ['insert', '\\begin{pmatrix}#0&#0\\end{pmatrix}'] },
        { label: '3x3 Matrix', command: ['insert', '\\begin{pmatrix}#0&#0&#0\\\\#0&#0&#0\\\\#0&#0&#0\\end{pmatrix}'] }
      ]
    },
    {
      label: 'Insert',
      submenu: [
        { label: 'Fraction', command: ['insert', '\\frac{#0}{#0}'] },
        { label: 'Square Root', command: ['insert', '\\sqrt{#0}'] },
        { label: 'Exponent', command: ['insert', '^{#0}'] },
        { label: 'Subscript', command: ['insert', '_{#0}'] },
        { label: 'Infinity', command: ['insert', '\\infty'] },
        { label: 'Pi', command: ['insert', '\\pi'] },
        { label: 'Theta', command: ['insert', '\\theta'] }
      ]
    }
  ];

  // Chuyển object thành chuỗi JSON để gán vào attribute HTML
  const MENU_ITEMS_JSON = JSON.stringify(customMenuItems);

  const parseValueToHTML = (text) => {
    if (!text) return '';
    const parts = text.split(/(\$[^$]+\$)/g);
    
    return parts.map(part => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const latex = part.slice(1, -1);
        // Gán trực tiếp cấu hình vào thẻ math-field qua attribute 'menu-items'
        return `<span contenteditable="false" style="display:inline-block; vertical-align:middle;">
                  <math-field 
                    style="display:inline-block; margin: 0 4px; min-width: 30px; cursor: pointer;" 
                    class="math-inline"
                    menu-items='${MENU_ITEMS_JSON}'
                    math-virtual-keyboard-policy="manual"
                  >${latex}</math-field>
                </span>`;
      }
      return part; 
    }).join('');
  };

  const parseHTMLToValue = () => {
    if (!editorRef.current) return "";
    let content = "";
    const traverse = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            content += node.textContent;
        } else if (node.tagName && node.tagName.toLowerCase() === 'math-field') {
            content += `$${node.value}$`;
        } else if (node.tagName === 'BR') {
            content += '\n';
        } else {
            node.childNodes.forEach(child => traverse(child));
        }
    };
    editorRef.current.childNodes.forEach(node => traverse(node));
    return content;
  };

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
        const currentVal = parseHTMLToValue();
        if (value !== currentVal) {
            editorRef.current.innerHTML = parseValueToHTML(value);
        }
    }
  }, [value]);

  const handleInput = () => {
    isInternalChange.current = true;
    const newValue = parseHTMLToValue();
    onChange(newValue);
    setTimeout(() => { isInternalChange.current = false; }, 0);
  };

  const insertFormula = () => {
    const editor = editorRef.current;
    editor.focus();

    const wrapper = document.createElement('span');
    wrapper.contentEditable = "false";
    wrapper.style.display = "inline-block";
    wrapper.style.verticalAlign = "middle";

    const mathField = document.createElement('math-field');
    mathField.style.display = 'inline-block';
    mathField.style.margin = '0 4px';
    mathField.style.minWidth = '40px'; 
    mathField.classList.add('math-inline');
    mathField.value = ''; 
    
    // --- KHẮC PHỤC LỖI: Dùng setAttribute thay vì gán property JS ---
    // Điều này đảm bảo cấu hình được nạp ngay lập tức và ổn định
    mathField.setAttribute('menu-items', MENU_ITEMS_JSON);
    mathField.setAttribute('math-virtual-keyboard-policy', 'manual');

    wrapper.appendChild(mathField);
    const spacer = document.createTextNode("\u00A0");

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      let range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(wrapper);
        range.setStartAfter(wrapper);
        range.insertNode(spacer);
        range.setStartAfter(spacer);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Focus vào mathField
        setTimeout(() => mathField.focus(), 0);
      } else {
        editor.appendChild(wrapper);
        editor.appendChild(spacer);
        mathField.focus();
      }
    } else {
        editor.appendChild(wrapper);
        editor.appendChild(spacer);
        mathField.focus();
    }
    
    handleInput();
  };

  return (
    <div className="formula-editor-wrapper" style={{ border: '1px solid #cfe0ff', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
      <div style={{ background: '#f0f4ff', padding: '8px 12px', borderBottom: '1px solid #e6ecff', display: 'flex', gap: '8px' }}>
        <button 
            type="button" 
            onClick={insertFormula}
            style={{
                background: '#fff', border: '1px solid #cfe0ff', borderRadius: '6px',
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                fontWeight: '600', color: '#0057FF', fontSize: '14px'
            }}
            title="Insert Math Formula"
        >
            <i className="bi bi-calculator"></i> Insert Formula
        </button>
        <span style={{ fontSize: '13px', color: '#666', alignSelf: 'center', marginLeft: 'auto' }}>
            <i className="bi bi-info-circle"></i> Click button to add math. Use Arrow Keys to exit formula.
        </span>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning={true}
        style={{
          minHeight: '80px',
          padding: '16px',
          outline: 'none',
          lineHeight: '1.8',
          fontSize: '16px',
          cursor: 'text',
          whiteSpace: 'pre-wrap'
        }}
      />
      
      <style>{`
        math-field.math-inline {
            border: 1px dashed transparent;
            background: rgba(0, 87, 255, 0.05);
            border-radius: 4px;
            transition: all 0.2s;
        }
        math-field.math-inline:focus-within, math-field.math-inline:hover {
            border-color: #0057FF;
            background: #fff;
            box-shadow: 0 0 0 2px rgba(0, 87, 255, 0.1);
        }
        
        /* Ẩn nút bàn phím ảo ở góc phải */
        math-field::part(virtual-keyboard-toggle) {
            display: none !important;
        }

        /* Đảm bảo nút Menu 3 gạch luôn hiện và dễ bấm */
        math-field::part(menu-toggle) {
            display: block !important;
            color: #0057FF;
            opacity: 0.8;
            width: 24px; 
            height: 24px;
        }
        math-field::part(menu-toggle):hover {
            opacity: 1;
            background-color: rgba(0,87,255,0.1);
            border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default FormulaEditor;