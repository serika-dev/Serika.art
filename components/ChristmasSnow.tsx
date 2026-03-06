'use client';

import { useEffect, useState } from 'react';
import { isChristmasTime } from '@/lib/christmas';

export default function ChristmasSnow() {
  const [isChristmas, setIsChristmas] = useState(false);

  useEffect(() => {
    const check = isChristmasTime();
    setIsChristmas(check);
    if (check) {
      document.body.classList.add('christmas-mode');
    }
    return () => {
      document.body.classList.remove('christmas-mode');
    };
  }, []);

  if (!isChristmas) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden" aria-hidden="true">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${Math.random() * 10 + 10}s`,
            opacity: Math.random() * 0.5 + 0.3,
            width: `${Math.random() * 6 + 4}px`,
            height: `${Math.random() * 6 + 4}px`,
          }}
        />
      ))}
    </div>
  );
}
