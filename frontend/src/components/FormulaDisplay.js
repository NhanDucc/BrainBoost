import React from 'react';
import 'mathlive';

/**
 * FormulaDisplay Component
 * Parses a string containing LaTeX math enclosed in '$' and renders it 
 * seamlessly alongside regular text. Fully supports Dark/Light mode natively.
 * @param {Object} props
 * @param {String} props.content - The raw string content containing text and math formulas.
 */
const FormulaDisplay = ({ content }) => {
  if (!content) return null;

  // Convert content to a string to prevent runtime errors if it is null, undefined, or a number
  const textContent = String(content);

  /**
  * Split the string based on the '$' delimiter. 
  * The capturing group in the regex ensures the delimiters are kept in the array
  * so we can distinguish math formulas from regular text later.
  */
  const parts = textContent.split(/(\$[^$]+\$)/g);

  return (
    <span className="formula-display-container" style={{ fontSize: '1.05em', lineHeight: '1.6', color: 'inherit' }}>
      {parts.map((part, index) => {
        // Check if the current segment is a math formula (enclosed in '$')
        if (part.startsWith('$') && part.endsWith('$')) {
          const latex = part.slice(1, -1); // Remove the wrapping '$' characters to extract the raw LaTeX
          return (
            <math-field
              key={index}
              read-only
              style={{
                display: 'inline-block',
                verticalAlign: '-3px',
                border: 'none',
                background: 'transparent',
                boxShadow: 'none',
                margin: '0 2px',
                padding: '0',
                color: 'inherit',
                cursor: 'default',
                pointerEvents: 'none',
              }}
            >
              {latex}
            </math-field>
          );
        }

        // Handle regular text: Parse and render newline characters ('\n') as <br /> tags
        return (
          <span key={index}>
            {part.split('\n').map((line, i, arr) => (
              <React.Fragment key={i}>
                {line}
                {/* Append a <br /> tag after each line, except for the very last one */}
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