# Releasing

This repo uses **SemVer tags** to publish GitHub Releases.

## Create a release

1) Make sure `package.json` versions are correct.
2) Create a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3) GitHub Actions will create the Release automatically (with release notes + optional assets).

## Version bumps (npm)

If you want npm to bump the version and create the tag:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

