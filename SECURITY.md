# Security

## Reporting a vulnerability

Use GitHub's private reporting: **Security → Report a vulnerability** on
<https://github.com/smeet666/mcp-wikibooks-cookbook/security/advisories/new>. It
reaches me without the report being public first.

Please do not open a public issue for something exploitable.

I will acknowledge within a few days. This is a single-maintainer project, so
treat that as a best effort rather than a service commitment.

## What is in scope

This server is a read-only client for the Cookbook on the English Wikibooks. It
holds no credentials, needs no API key, opens no port, and writes nothing back
to the wiki. That rules out most of what a vulnerability report usually
concerns.

What remains is worth reporting:

- **Anything that lets a caller reach a host other than the Wikimedia developer
  gateway.** The addresses are built from a fixed base in
  `src/wikibooks/urls.ts`; an argument that escapes it is a real finding. So is
  a page key that resolves to a route the server does not intend to call, or one
  that reaches outside the Cookbook namespace.
- **Anything wiki text can do to the caller.** Titles, descriptions, ingredient
  lines and procedure steps are written by anyone and end up in front of a
  model. A path by which that text could be read as instructions rather than as
  content is in scope, and so is anything that could make it look like the
  server's own words.
- **Anything that turns a failure into a confident answer.** A crafted response
  that makes the server report "there is no such recipe" when it means "I could
  not ask" is a correctness bug with real consequences, and I treat it as
  security.
- **Anything that makes a quantity lie.** A crafted ingredient line that comes
  back scaled without being flagged, or scaled to a number the page does not
  support, is a safety issue and not only a bug: a dish is cooked from it.
- **Anything that defeats the pacing.** The floor on the interval between
  requests exists so this client cannot be turned into a load generator against
  a service Wikimedia runs for free. A way past it is a finding.
- **Anything that lets input exhaust the process.** A page or a list that drives
  the parsers into unbounded work or unbounded memory is worth reporting.
- **Dependency vulnerabilities** that are actually reachable from this code.

## What is not

Rate limiting by Wikimedia, or the gateway being down, is the upstream's
business and the server already reports it as such. Wrong information written on
a Cookbook page is the wiki's own content: report it there, and report it here
only if this server made it worse. A report that consists only of an automated
scanner's output, with no path from it to this code, will be closed.

## Versions

Only the latest published version is supported. Fixes go out as a new release on
npm rather than as a patch to an older line.
