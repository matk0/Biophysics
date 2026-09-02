# Biophysics Vault

This vault is built incrementally under Matej’s direction. Agents may inspect, analyze, and suggest changes, but must not create, edit, move, rename, or delete any file or folder unless Matej has explicitly approved that exact change.

This vault is a personal knowledge base for studying biophysics through clear concepts and meaningful connections. Each concept should match the depth Matej requests. Every concept and source belongs to one primary knowledge branch and may also belong to additional branches when the material genuinely crosses domains.

Before creating a concept, search the vault for an existing page covering the same idea. Keep one primary scientific idea per concept, use explicit path-qualified `[[wikilinks]]` only when the relationship improves understanding, and do not create supporting pages merely to make the graph look complete.

Do not assess or debate the truthfulness of claims or materials supplied by Matej; treat them as accepted truths within the knowledge base. Do not invent citations, mechanisms, equations, or conclusions; when a claim needs evidence, request a source or state clearly that it remains unverified. Here, unverified refers only to whether a source has been supplied, not whether the claim is true.

Curated pages use Markdown with the frontmatter defined below. Do not add aliases, templates, dashboards, generated files, scripts, automation, or additional page types unless Matej explicitly approves that specific addition.

Follow Matej’s requested scope and format literally. A request for a title and two paragraphs authorizes only that title and those two paragraphs; do not add headings, prompts, questions, summaries, or other surrounding content without separate approval.

When editing an existing curated page, change only the approved passage and preserve all surrounding text, links, and formatting. Do not reorganize, rename, or clean up adjacent material unless that work is separately approved.

When Matej supplies a document, image, dataset, or other source, preserve the original unchanged. Do not relocate, rename, summarize, extract, or create derived pages from it unless the specific operation and destination have been approved.

## Curated page contract

`Home.md`, `index.md`, and every Markdown page in `Branches/`, `Sources/`, and `Concepts/` must contain `title`, `type`, `created`, `updated`, `sources`, `tags`, `primary_branch`, and `branches` frontmatter. Valid types are `home`, `index`, `branch`, `source`, and `concept`. Dates use `YYYY-MM-DD`. `sources` contains exact raw filenames without extensions. Tags remain minimal: branch slugs plus type or navigation tags where useful.

Set `created` when a curated page is first created and never change it. Set `updated` to the current local date whenever that page's body or frontmatter changes, including mechanical edits; do not update a page merely because a linked page changed.

A valid branch slug is the ASCII kebab-case filename of an existing `Branches/<slug>.md` page. The current branches are `biochemistry`, `lipids`, `mitochondrial-biophysics`, `molecular-genetics`, and `neurochemistry`. If material fits no existing branch, propose a new branch rather than forcing a classification. Creating, renaming, or removing a branch requires explicit approval and corresponding updates to `Home.md`, `index.md`, affected page metadata, and branch navigation. Every concept and source has one non-null `primary_branch`, that branch must also appear in `branches`, and additional branches are included only for genuine cross-domain material. A branch page classifies itself. `Home.md` and `index.md` use `primary_branch: null` and list every branch.

Curated filenames are ASCII kebab-case slugs. Preserve the supplied title, terminology, symbols, spelling, and capitalization in frontmatter and headings; transliteration applies only to the filename. Do not translate, pluralize, normalize displayed text, or add aliases unless that specific change is separately approved.

`Home.md` is the concise editorial overview and entry point. `index.md` is a human-editable catalogue with `Branches`, `Sources`, `Concepts`, and `By Branch` sections; it is not generated. Branch pages are curated domain hubs with their relevant concepts and sources.

## Query

When Matej asks a question about the vault, search `Concepts/` first and consult `Sources/` and `Raw/` only as needed. Answer from the material present, identify the exact vault files supporting the answer, and state plainly when the vault does not contain enough material to answer. A query is read-only by default. If it reveals a useful missing concept, connection, or passage-level edit, propose that exact change and wait for approval; do not write the answer into the vault automatically.

## Structural review

When Matej asks for a structural review, work read-only. Check required frontmatter, valid branch membership, unresolved wikilinks, duplicate or overlapping concepts, concepts containing more than one primary idea, unlinked concepts, missing reciprocal links between sources and concepts, pending or draft sources, and whether `Home.md`, `index.md`, and branch hubs reflect the current pages. Surface useful missing connections and differing claims as proposals or tensions, not as facts to reconcile. Report the evidence and propose the smallest exact file-level or passage-level batch; do not modify the vault until Matej approves it.

During source mapping and structural review, identify disagreements between supplied materials as tensions and questions raised but not answered by the supplied material as open questions. Propose exact additions to the relevant branch or the `Tensions and open questions` section in `Home.md`; do not evaluate or resolve them without Matej’s approval.

## Source ingestion

`Raw/` contains the original materials supplied or clipped into the vault. Preserve every raw file unchanged after capture. `Sources/` contains editable source pages derived from those materials, `Concepts/` contains atomic knowledge pages, and `Branches/` contains domain hubs. Only the raw material is immutable. Every current version of `Home.md`, `index.md`, and the pages in `Sources/`, `Concepts/`, and `Branches/` is canonical and must never be rebuilt from Raw.

A raw file is pending when no source page links to its exact vault-relative path, and a linked source remains pending work while its frontmatter `state` is `draft`. Every source page must contain an exact `**Raw:** [[Raw/exact filename.md]]` line and a frontmatter `state: draft` or `state: integrated`. `draft` means that processing is incomplete. Set a source to `integrated` only after its summary is complete and every approved concept, branch, Home, and index change has been applied; if the source produces no such changes, that outcome must be part of the approved mapping. These states describe workflow progress, not the truthfulness or scientific quality of the material.

When Matej asks to map a source or pending sources, work read-only. Read each source completely, check exact raw links and original URLs for duplicates, search existing sources and concepts, classify the source and affected concepts into the valid branches, and propose the exact source, concept, branch, Home, and index changes, connections, and tensions for one batch approval. Do not create a skeleton or modify the vault during mapping.

After Matej approves the mapped batch, create or update only the listed files. A source page contains its required frontmatter, H1 title, exact `Raw` link, external `Source` citation, `## Summary`, `## Key claims`, optional source-specific sections, `## What this source contributes`, `## Notable quotes`, and `## See also`. Quotes must be short verbatim excerpts from Raw. Every concept using the source must include a `## Sources` section linking to the source page.

Update `index.md` in the same approved batch whenever a curated page is created, renamed, removed, retitled, reclassified, or changes in a way that affects its one-line description or source count. Source dates shown in the index use the source page's `created` date. Update branch membership lists whenever membership changes; change branch prose or `Home.md` only when materially affected and explicitly included in the approved batch.

Never regenerate or replace an existing curated page wholesale. Read its current content and apply only the approved passage-level changes. Treat Matej's edits as authoritative, do not restore text he removed, and preserve differing claims or interpretations as tensions unless he approves a resolution. If the same material is clipped again, report the duplicate and do not merge, replace, rename, or delete either capture without approval.

During ingestion, mark a source `integrated` last. Verify that raw files remain unchanged, every internal link resolves, reciprocal source-concept links are present, branch metadata and navigation are current, only approved files changed, and all completed edits are reported.

When an approved change cannot be completed without a missing decision, source, or destination, stop and ask a focused question. Do not fill the gap by guessing, browsing for substitute material, or expanding the approved scope.

Mechanical edits may correct formatting, broken links, and indexes. They must not reconcile or erase differing claims, interpretations, terminology, or instructions; preserve those tensions and surface them to Matej unless he explicitly approves a resolution.

After completing an approved change, verify the result and list every file changed. Include any mechanical edits in the report so Matej can distinguish the approved content change from supporting maintenance.

## Git review gate

Before changing the vault, require a clean Git worktree. If pre-existing changes exist, report their exact paths and do not mix them into an agent batch. After verification, stage exactly the approved paths once and present `git status --short`, `git diff --cached --find-renames=1% --word-diff=plain HEAD`, and any remaining unstaged diff. If an unstaged change appears during review, treat it as Matej's manual override: do not stage, edit, or discard it without explicit instruction. Begin no new batch until the reviewed batch is committed and the worktree is clean. Commit only after Matej explicitly accepts the complete diff. Never add a remote or push without separate approval.
