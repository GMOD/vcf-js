# Contributing

## Development

```sh
pnpm install
pnpm test
pnpm build
```

Use `pnpm version patch/minor/major` to release — it runs lint, format, types,
tests and build, regenerates CHANGELOG.md with git-cliff, then pushes the
version tag which triggers the publish workflow.

[docs/api.md](docs/api.md) is written by hand, and `test/apiDocs.test.ts` fails
when a public member of `VCFParser`, `Variant`, `Breakend`,
`LocalAlleleGenotypeMaps`, or an export, is missing from it. Document the new
member, or add it to the test's `undocumented` list with the reason it is
internal.

## Publishing

Releases publish automatically via GitHub Actions using npm trusted publishing
(OIDC, no stored token). The workflow requires `--provenance` and
`id-token: write` permissions.

vcf-js is already configured. To set up a new package:
`npm trust github <pkg> --file publish.yml --repo GMOD/<repo>` (requires
npm >=11.10.0 and 2FA).

Once npm publish succeeds, the `release` job creates the GitHub release for the
tag, taking its notes from that version's CHANGELOG.md section.
`scripts/release-notes.sh` extracts the section, so run the script with a
version to preview a release's notes.
