# Browser smoke-test findings

- Local dev server loaded at `http://localhost:4173/` with title `Moonex`.
- Header selector visibly displays `Moonex Lite 1.5` and `Fast`.
- Welcome assistant message displays `Moonex` and `Moonex Lite 1.5`.
- Composer status bar visibly displays `Moonex Lite 1.5`.
- Footer disclaimer now reads `Moonex can make mistakes...`.
- The app is unauthenticated in the sandbox, so sending a real chat request is blocked by the existing sign-in gate. Selector interaction can still be smoke-tested.

## Manual selector verification

After opening the selector, the menu showed `Auto` plus all nine Moonex profiles, each with a Moonex display name. Selecting `Moonex Ultra 1.5` immediately changed both the header selector and composer status from `Moonex Lite 1.5` to `Moonex Ultra 1.5`; no provider identifier appeared in the visible page content.

## Auto-mode selector verification

Switching from `Moonex Ultra 1.5` to `Auto` immediately changed the header selector and composer status to `Auto`, with the `Recommended` badge. The rendered page contained only Moonex profile names and no provider IDs.
