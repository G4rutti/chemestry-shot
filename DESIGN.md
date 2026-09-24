# Design System: Study Shot - Duolingo x Lifesum
**Project ID:** 1757234987165722277

## 1. Visual Theme & Atmosphere
Playful, chunky and warm. Duolingo's tactile "press me" energy (thick bottom edges, bold green, a cute mascot talking in speech bubbles) sits on Lifesum's calm, airy cream canvas with large friendly headings. Mobile-first, one clear action per screen, generous whitespace, nothing sharp or corporate.

## 2. Color Palette & Roles
* **Feather Green (#58CC02)** – primary actions, progress fills, success, mastery.
* **Deep Leaf Edge (#46A302)** – darker bottom edge under green buttons; brand text on light backgrounds.
* **Warm Cream Canvas (#F9F6F1)** – page background (Lifesum).
* **Pure White (#FFFFFF)** – tiles, cards, speech bubbles.
* **Warm Stone Border (#E5E2DD)** – tile outlines, empty progress track, neutral chips.
* **Soft Parchment (#F0EDE9)** – subtle fills (number badges, secondary surfaces).
* **Ink (#1C1C19)** – headings and primary text.
* **Macaw Blue (#1CB0F6) on Ice (#DDF4FF), edge (#84D8FF)** – hover/selection state of answer tiles, flipped flashcards, secondary links.
* **Fox Orange (#FF9600)** – XP, streak 🔥, importance stars.
* **Cardinal Red (#FF4B4B)** – wrong answers, open mistakes, destructive/retry.
* **Beetle Purple (#9C27B0 / #CE82FF)** – highlighted keywords inside questions.

## 3. Typography Rules
Nunito everywhere, rounded and friendly. Headings extra-bold (800) to black (900), slightly tight tracking, 28–32px on screen titles (Lifesum scale). Body 16–18px at semibold/bold weight. Buttons and section labels are UPPERCASE, extra-bold, widely letter-spaced (~0.06–0.08em). Numbers use tabular figures.

## 4. Component Stylings
* **Buttons:** generously rounded (16px) with a darker 4px bottom edge that collapses when pressed (the "3D" Duolingo press). Primary is Feather Green with white uppercase label; secondary is white with a stone border and blue label.
* **Cards/Containers (tiles):** white, 16px rounded corners, 2px Warm Stone border with a thicker 4px bottom border instead of a drop shadow. Flat, never blurry shadows.
* **Answer options:** full-width tiles with a round number badge on the left and a radio circle on the right; blue on hover, green with ✓ when right, red with ✕ when wrong.
* **Speech bubble:** white tile with a small tail pointing at the round, bordered mascot avatar (Erlenmeyer flask with a kawaii face).
* **Progress bars:** thick (14–16px) pill-shaped stone track with a green pill fill.
* **Chips/pills:** pill-shaped, 2px stone border, uppercase extra-bold captions (topic chip, XP/streak counters).
* **Inputs/Forms:** same tile treatment (2px border, 4px bottom), blue edge on focus.

## 5. Layout Principles
Single centered column (max ~576px for study flows, ~900px for home), 16–24px gutters, 12px gaps between stacked tiles and 24px between sections. The primary action is full-width at the bottom of the flow. Stats sit in a 4-up grid of small centered tiles (2-up on phones).
