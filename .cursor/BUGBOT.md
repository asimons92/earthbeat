# Earthbeat review rules

## Typecheck (required)

Before you finish the review, run this from the repo root:

```bash
pnpm typecheck
```

That command typechecks the Vite client and the Express server the same way Railway `pnpm build` does for TypeScript.

If typecheck exits non-zero, report every compiler error as a Critical finding with `file:line` and the compiler message. Do not treat a clean typecheck as proof that the change is correct. Keep looking for logic, security, and product bugs.
