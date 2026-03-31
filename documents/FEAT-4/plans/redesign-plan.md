# FEAT-4: Frontend Redesign — Aurora Glow (Dark Mode)

## Overview

Redesign the Zap URL shortener frontend with an **Aurora Glow** aesthetic inspired by Linear, Vercel, and Raycast. Dark-first design with animated gradient blobs, glassmorphic surfaces, glow effects, and full light/dark mode support.

---

## Design Concept: Aurora Glow

**Inspiration**: Linear.app, Vercel, Raycast — the dominant SaaS aesthetic of 2025-2026.

### Core Visual Elements

1. **Animated aurora gradient blobs** — large, blurred, slowly-drifting colored orbs (violet, cyan, fuchsia) behind the content
2. **Glassmorphic card** — semi-transparent surface with `backdrop-blur-xl`, thin luminous borders
3. **Gradient text** — headline uses `bg-clip-text` with violet→fuchsia→cyan gradient
4. **Glow effects** — inputs glow violet on focus, button radiates on hover
5. **Dot grid overlay** — subtle repeating radial-gradient pattern for texture
6. **Center radial glow** — soft violet radial gradient to draw focus

---

## Dark Mode Strategy

### Approach: Class-based toggle with `localStorage` persistence

1. **Tailwind CSS v4**: `@custom-variant dark` in `globals.css`
2. **ThemeProvider**: Reads `localStorage('theme')` or system preference
3. **ThemeToggle**: Glassmorphic sun/moon button, fixed top-right
4. **Anti-FOUC**: Inline `<script>` in `<head>` applies `.dark` before paint

### Anti-FOUC Script: Approach Comparison & Decision

Theme detection must run synchronously before React hydration to prevent Flash of Unstyled Content (FOUC).

| Approach | Implementation | Pros | Cons |
|----------|---------------|------|------|
| **A. Cookie-based (Server-side)** | Server Component reads cookie to determine `<html class>` | Zero client script; SSR renders correct theme directly | Cannot detect `prefers-color-scheme` on first visit without cookie; requires light fallback or still needs inline script |
| **B. `next/script` + external file** | `<Script src="/scripts/theme-init.js" strategy="beforeInteractive" />` | Avoids `dangerouslySetInnerHTML` | Extra HTTP request; extra file to maintain; fundamentally the same as inline script with different syntax |
| **C. `initTheme.toString()` (adopted)** | Define a real JS function, serialize via `.toString()` as IIFE injected into `<head>` | Full syntax highlighting / linting / type-checking; zero extra requests; same approach used by `next-themes` and other mainstream libraries | Still uses `dangerouslySetInnerHTML` (but content is a static self-defined function with no security concern) |

**Decision**: Adopted approach C. `dangerouslySetInnerHTML` is completely safe in this context (content is a self-defined static function with no user input) and is the industry-standard pattern for SSR frameworks. Compared to the original raw string, refactoring to a real function + `.toString()` provides full editor tooling support.

---

## Color System

### Dark Mode (Primary aesthetic)

| Role | Value | Class |
|------|-------|-------|
| Background | `#09090b` | `dark:bg-[#09090b]` |
| Aurora blob 1 | violet-600/25 | `dark:bg-violet-600/25` |
| Aurora blob 2 | cyan-500/20 | `dark:bg-cyan-500/20` |
| Aurora blob 3 | fuchsia-500/15 | `dark:bg-fuchsia-500/15` |
| Card surface | white/4% | `dark:bg-white/[0.04]` |
| Card border | white/8% | `dark:border-white/[0.08]` |
| Input surface | white/4% | `dark:bg-white/[0.04]` |
| Input border | white/10% | `dark:border-white/[0.1]` |
| Focus glow | violet-400 | `dark:focus:shadow-[0_0_20px_rgba(139,92,246,0.2)]` |
| Text primary | zinc-100 | `dark:text-zinc-100` |
| Text secondary | zinc-400 | `dark:text-zinc-400` |
| Button | violet→fuchsia→violet gradient | `bg-gradient-to-r` |
| Button glow | violet-500/45% | `dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.45)]` |

### Light Mode

| Role | Value | Class |
|------|-------|-------|
| Background | slate-50 | `bg-slate-50` |
| Aurora blobs | softer opacity (10-15%) | `bg-violet-500/15` etc. |
| Card surface | white/70% | `bg-white/70` |
| Card border | slate-200/60% | `border-slate-200/60` |
| Input surface | white | `bg-white` |
| Input border | slate-200 | `border-slate-200` |
| Focus glow | violet-500 (subtle) | `focus:shadow-[0_0_20px_rgba(139,92,246,0.1)]` |
| Text primary | slate-900 | `text-slate-900` |
| Text secondary | slate-500 | `text-slate-500` |

---

## Animation System

Three aurora blob animations with different durations (25s, 30s, 35s) creating organic, non-repeating drift patterns. Each keyframe moves the blob through 4 positions with slight scale variations.

```
aurora-1: 25s — main violet blob, top-left
aurora-2: 30s — cyan blob, bottom-right
aurora-3: 35s — fuchsia blob, center-right
```

Respects `prefers-reduced-motion: reduce`.

---

## Accessibility

- All text passes WCAG AA contrast (4.5:1)
- Focus rings visible in both themes
- Theme toggle has `aria-label`
- Aurora blobs marked `aria-hidden="true"`
- Animations disabled when `prefers-reduced-motion: reduce`

---

## Files Changed

| File | Action |
|------|--------|
| `src/app/globals.css` | Aurora keyframes, `@theme` tokens, reduced-motion |
| `src/app/layout.tsx` | Anti-FOUC script, body transition |
| `src/app/providers.tsx` | ThemeProvider wrapper |
| `src/app/page.tsx` | Full Aurora Glow redesign |
| `src/components/theme-provider.tsx` | **New** — theme context |
| `src/components/theme-toggle.tsx` | **New** — glassmorphic toggle |
