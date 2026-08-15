import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Claude Code keeps its git worktrees in .claude/worktrees/ — another
    // checkout of this repo, inside it — and vitest's include glob matches
    // dotfolders, so a live worktree runs the whole suite twice, half of it
    // against a tree you are not looking at. Spread the defaults rather than
    // replacing them, or node_modules gets collected.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
