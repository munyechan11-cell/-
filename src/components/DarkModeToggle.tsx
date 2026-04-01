import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="fixed bottom-24 right-6 z-[60] p-4 rounded-3xl bg-white border border-[#e5dcd3] shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 group"
      aria-label="Toggle Dark Mode"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-primary group-hover:rotate-45 transition-transform duration-500" />
      ) : (
        <Moon className="w-5 h-5 text-primary/40 group-hover:-rotate-12 transition-transform duration-500" />
      )}
    </button>
  );
}
