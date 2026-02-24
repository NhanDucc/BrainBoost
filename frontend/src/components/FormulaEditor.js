import React, { useEffect, useRef } from 'react';
import 'mathlive';

/**
 * FormulaEditor Component
 * A custom WYSIWYG editor that allows users to seamlessly mix regular text
 * and mathematical formulas using the MathLive library.
 * @param {Object} props
 * @param {String} props.value - The raw string value containing text and $...$ math blocks.
 * @param {Function} props.onChange - Callback function triggered when the editor content changes.
 * @param {String} props.placeholder - Placeholder text when the editor is empty.
 */
const FormulaEditor = ({ value, onChange, placeholder = "Type content here..." }) => {
  const editorRef = useRef(null);
  // Flag to prevent infinite re-rendering loops when changes originate from within the editor
  const isInternalChange = useRef(false);

  // ==========================================
  // MATH-FIELD MENU CONFIGURATION
  // ==========================================
  // Defines a custom context menu for the math fields to provide quick access to common templates.
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

  // Convert the configuration object into a JSON string to be safely injected as an HTML attribute
  const MENU_ITEMS_JSON = JSON.stringify(customMenuItems);

  /**
   * Parses the raw string (containing $ delimiters) into an HTML structure 
   * where formulas are rendered as <math-field> web components.
   * @param {String} text - Raw input string.
   * @returns {String} HTML string ready to be injected into the contenteditable div.
   */
  const parseValueToHTML = (text) => {
    if (!text) return '';
    const parts = text.split(/(\$[^$]+\$)/g);
    
    return parts.map(part => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const latex = part.slice(1, -1);
        // Inject the math-field configuration directly via attributes (menu-items and policy)
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

  /**
   * Traverses the editor's DOM tree to reconstruct the raw string.
   * Extracts standard text and converts <math-field> elements back into $...$ wrapped LaTeX.
   * @returns {String} The reconstructed raw text value.
   */
  const parseHTMLToValue = () => {
    if (!editorRef.current) return "";
    let content = "";
    
    // Recursive function to walk through the DOM nodes
    const traverse = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            content += node.textContent;
        } else if (node.tagName && node.tagName.toLowerCase() === 'math-field') {
            content += `$${node.value}$`; // Extract LaTeX and wrap in $ delimiters
        } else if (node.tagName === 'BR') {
            content += '\n'; // Preserve line breaks
        } else {
            node.childNodes.forEach(child => traverse(child));
        }
    };
    
    editorRef.current.childNodes.forEach(node => traverse(node));
    return content;
  };

  // Sync external value changes into the editor's innerHTML
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
        const currentVal = parseHTMLToValue();
        // Only update innerHTML if the external value differs from the current DOM state
        if (value !== currentVal) {
            editorRef.current.innerHTML = parseValueToHTML(value);
        }
    }
  }, [value]);

  /**
   * Handles user typing within the contenteditable area.
   * Parses the new DOM state and passes the raw string up to the parent component.
   */
  const handleInput = () => {
    isInternalChange.current = true;
    const newValue = parseHTMLToValue();
    onChange(newValue);
    
    // Reset flag in the next event loop cycle
    setTimeout(() => { isInternalChange.current = false; }, 0);
  };

  /**
   * Programmatically injects a new, empty <math-field> at the user's current cursor position.
   */
  const insertFormula = () => {
    const editor = editorRef.current;
    editor.focus();

    // Create a non-editable wrapper to prevent the browser from splitting the math component
    const wrapper = document.createElement('span');
    wrapper.contentEditable = "false";
    wrapper.style.display = "inline-block";
    wrapper.style.verticalAlign = "middle";

    // Create the MathLive web component
    const mathField = document.createElement('math-field');
    mathField.style.display = 'inline-block';
    mathField.style.margin = '0 4px';
    mathField.style.minWidth = '40px'; 
    mathField.classList.add('math-inline');
    mathField.value = ''; 
    
    // FIX: Use setAttribute instead of JS properties to guarantee configurations 
    // are loaded reliably as soon as the element attaches to the DOM.
    mathField.setAttribute('menu-items', MENU_ITEMS_JSON);
    mathField.setAttribute('math-virtual-keyboard-policy', 'manual');

    wrapper.appendChild(mathField);
    
    // Add a trailing non-breaking space so the user can continue typing normally after the formula
    const spacer = document.createTextNode("\u00A0");

    // Retrieve the user's current selection/cursor position
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      let range = selection.getRangeAt(0);
      
      // Ensure the cursor is actually inside our editor before injecting
      if (editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(wrapper);
        range.setStartAfter(wrapper);
        range.insertNode(spacer);
        range.setStartAfter(spacer);
        
        // Collapse the selection to act like a standard cursor
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Auto-focus the new math field for immediate typing
        setTimeout(() => mathField.focus(), 0);
      } else {
        // Fallback: Append to the very end if cursor is outside
        editor.appendChild(wrapper);
        editor.appendChild(spacer);
        mathField.focus();
      }
    } else {
      // Fallback: Append to the very end if no cursor range exists
      editor.appendChild(wrapper);
      editor.appendChild(spacer);
      mathField.focus();
    }
    
    // Force a manual update to sync the state
    handleInput();
  };

  return (
    <div className="formula-editor-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-card)', overflow: 'hidden' }}>
      
      {/* TOOLBAR */}
      <div style={{ background: 'var(--bg-input)', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
        <button 
            type="button" 
            onClick={insertFormula}
            style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-input)', borderRadius: '6px',
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                fontWeight: '600', color: 'var(--primary)', fontSize: '14px'
            }}
            title="Insert Math Formula"
        >
            <i className="bi bi-calculator"></i> Insert Formula
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: 'auto' }}>
            <i className="bi bi-info-circle"></i> Click button to add math. Use Arrow Keys to exit formula.
        </span>
      </div>

      {/* EDITING AREA */}
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
          whiteSpace: 'pre-wrap',
          color: 'var(--text-main)',
          background: 'transparent'
        }}
      />
      
      {/* COMPONENT-SPECIFIC STYLES FOR SHADOW DOM ELEMENTS */}
      <style>{`
        math-field.math-inline {
            border: 1px dashed transparent;
            background: var(--bg-object);
            color: var(--text-main);
            border-radius: 4px;
            transition: all 0.2s;
        }
        math-field.math-inline:focus-within, math-field.math-inline:hover {
            border-color: var(--primary);
            background: var(--bg-card);
            box-shadow: 0 0 0 2px rgba(0, 87, 255, 0.1);
        }
        
        /* Hide the default virtual keyboard toggle button on the far right */
        math-field::part(virtual-keyboard-toggle) {
            display: none !important;
        }

        /* Ensure the custom 'hamburger' context menu is always accessible */
        math-field::part(menu-toggle) {
            display: block !important;
            color: var(--primary);
            opacity: 0.8;
            width: 24px; 
            height: 24px;
        }
        math-field::part(menu-toggle):hover {
            opacity: 1;
            background-color: var(--bg-hover);
            border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default FormulaEditor;