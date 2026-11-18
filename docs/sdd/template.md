# SDD-NNNN: <Feature or Initiative Title>

- **Status:** Draft | Approved | In Progress | Implemented | Superseded
- **Phase:** Phase X
- **Author:** <Name / Agent>
- **Date:** YYYY-MM-DD
- **Related ADRs:** `docs/adr/NNNN-*.md` *(if any)*

---

## 1. Problem Statement & Goal
Describe what user problem or engineering milestone this specification addresses and why it is needed now.

## 2. Scope
### In Scope
- Item 1

### Out of Scope
- Item 1

## 3. Functional Requirements
1. **FR-1:** ...
2. **FR-2:** ...

## 4. UI, Accessibility & Dark Mode Requirements
- Follow design tokens in `src/index.css` for Light and Dark modes.
- Zero emojis in UI; use inline vector SVGs.
- Responsive behavior across desktop (`>=1024px`), tablet, and mobile.
- Required ARIA roles, labels, and keyboard interactions.

## 5. Architecture & Contracts
### Affected Files / Modules
- `src/pages/...`
- `src/components/...`
- `src/hooks/...`
- `src/store/slices/...`
- `src/services/...`
- `src/utils/...`

### State & API Contracts
Specify new routes, Redux slice fields/actions/selectors, hook signatures, or `productsApi` methods.

## 6. Edge Cases & Guardrails
- Error states, empty states, stock/input bounds, `AbortController` cleanup, `localStorage` fallback.

## 7. Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] `npm run lint` passes with 0 errors and 0 warnings
- [ ] `npm run build` succeeds
- [ ] Browser flow validated in Light & Dark modes across desktop/mobile
- [ ] `docs/` inventories (and `docs/adr/` if applicable) updated

## 8. Verification Plan
Steps to verify implementation manually in browser and/or via automated tests.
