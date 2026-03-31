# FEAT-4: Implementation Guide

## 1. globals.css — Theme Foundation

```css
@import 'tailwindcss';

/* Class-based dark mode for Tailwind v4 */
@custom-variant dark (&:where(.dark, .dark *));

/* Smooth theme transitions */
html {
  transition: color 0.2s ease, background-color 0.2s ease;
}
```

Key points:
- `@custom-variant dark` enables `dark:` utilities based on `.dark` class on `<html>`
- Global transition ensures smooth color changes during theme switch

---

## 2. ThemeProvider — `src/components/theme-provider.tsx`

Client component providing theme context:

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Read from localStorage or system preference
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored) {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

---

## 3. ThemeToggle — `src/components/theme-toggle.tsx`

```tsx
'use client';

import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="fixed top-5 right-5 z-50 rounded-full p-2.5
        bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm
        border border-slate-200 dark:border-zinc-700
        text-slate-600 dark:text-zinc-400
        hover:text-violet-600 dark:hover:text-violet-400
        shadow-sm hover:shadow-md transition-all duration-200
        cursor-pointer"
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

// Inline SVG icons (no extra dependencies)
function SunIcon() { ... }
function MoonIcon() { ... }
```

---

## 4. layout.tsx — Anti-FOUC Script

Define a real JS function and serialize it via `.toString()` as an IIFE injected into `<head>`, executing synchronously before React hydration:

```tsx
function initTheme() {
  const theme = localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(${initTheme.toString()})()` }} />
      </head>
      <body className="bg-slate-50 dark:bg-zinc-950 transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- `initTheme` is a real function — provides syntax highlighting, linting, and type-checking (easier to maintain than a raw string)
- `initTheme.toString()` serializes the function as an IIFE string injected into HTML at server render time
- `suppressHydrationWarning` prevents React hydration mismatch warning
- Script executes synchronously before paint, preventing FOUC

---

## 5. providers.tsx — Add ThemeProvider

```tsx
import TanStackQueryProvider from '@/vendors/tanstack-query/provider';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TanStackQueryProvider>{children}</TanStackQueryProvider>
    </ThemeProvider>
  );
}
```

---

## 6. page.tsx — Full Redesign

### Structure

```
<main>                    — full-height gradient bg (light/dark)
  <ThemeToggle />         — fixed top-right
  <div>                   — centered container
    <header>              — logo + tagline
      <h1>⚡ Zap</h1>
      <p>tagline</p>
    </header>
    <div>                 — card surface
      <form>
        <input longUrl />
        <input customAlias />
        <button submit />
      </form>
      <div error />       — conditional
      <div success />     — conditional
    </div>
    <footer />
  </div>
</main>
```

### Key Class Patterns

**Background gradient:**
```
bg-gradient-to-br from-slate-50 to-slate-100
dark:from-zinc-950 dark:to-zinc-900
```

**Card surface:**
```
bg-white border-slate-200 shadow-sm
dark:bg-zinc-900/80 dark:border-zinc-700/50 dark:shadow-lg dark:shadow-black/20
```

**Inputs:**
```
bg-white border-slate-300 text-slate-900 placeholder:text-slate-400
dark:bg-zinc-800/50 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder:text-zinc-500
focus:ring-violet-500 dark:focus:ring-violet-400
```

**Primary button:**
```
bg-violet-600 text-white hover:bg-violet-500
dark:bg-violet-500 dark:hover:bg-violet-400
```

**Success alert:**
```
bg-emerald-50 border-emerald-200 text-emerald-700
dark:bg-emerald-950/50 dark:border-emerald-800/50 dark:text-emerald-400
```

**Error alert:**
```
bg-red-50 border-red-200 text-red-700
dark:bg-red-950/50 dark:border-red-800/50 dark:text-red-400
```

---

## Files Changed Summary

| File | Action |
|------|--------|
| `src/app/globals.css` | Add dark variant, transitions |
| `src/app/layout.tsx` | Add anti-FOUC script, suppressHydrationWarning |
| `src/app/providers.tsx` | Wrap with ThemeProvider |
| `src/app/page.tsx` | Full redesign with dark: variants |
| `src/components/theme-provider.tsx` | **NEW** — theme context + persistence |
| `src/components/theme-toggle.tsx` | **NEW** — toggle button with icons |
