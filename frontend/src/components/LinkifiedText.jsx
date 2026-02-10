// src/components/LinkifiedText.jsx
// Component to automatically detect and make URLs clickable

import React from 'react';

/**
 * Detects URLs in text and makes them clickable links
 * Supports http://, https://, and www. URLs
 */
export default function LinkifiedText({ text, className = '' }) {
  // URL regex pattern - matches http://, https://, and www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

  // Split text by URLs
  const parts = text.split(urlRegex);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part is a URL
        if (part.match(urlRegex)) {
          // Ensure URL has protocol
          const href = part.startsWith('http') ? part : `https://${part}`;
          
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline break-all"
              onClick={(e) => e.stopPropagation()} // Prevent bubbling
            >
              {part}
            </a>
          );
        }
        
        // Regular text
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}