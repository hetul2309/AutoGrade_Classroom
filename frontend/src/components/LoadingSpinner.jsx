import React, { useState, useEffect } from 'react';
import lightLoading from '../assets/light_loading.svg';
import darkLoading from '../assets/dark_loading.svg';

export default function LoadingSpinner({
  size = 56,
  text = 'Loading...',
  fullScreen = false,
  minHeight = '320px',
  style = {}
}) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });

  useEffect(() => {
    const checkTheme = () => {
      const active = document.documentElement.getAttribute('data-theme') || 'light';
      setCurrentTheme(active);
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => observer.disconnect();
  }, []);

  const svgSrc = currentTheme === 'dark' ? darkLoading : lightLoading;

  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '24px',
        ...style
      }}
    >
      <img
        src={svgSrc}
        alt="Loading..."
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
          userSelect: 'none'
        }}
      />
      {text && (
        <div
          style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
            animation: 'pulse 1.8s infinite ease-in-out'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          zIndex: 99999
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {content}
    </div>
  );
}
