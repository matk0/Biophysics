# Biophysics Vault

This vault is built incrementally under Matej’s direction. Agents may inspect, analyze, and suggest changes, but must not create, edit, move, rename, or delete any file or folder unless Matej has explicitly approved that exact change.

This vault is a personal knowledge base for studying biophysics through clear notes and meaningful connections. Each note should match the depth Matej requests, and the structure should emerge from the material actually added rather than from a predefined taxonomy.

Before creating a note, search the vault for an existing page covering the same idea. Keep one primary scientific idea per note, use ordinary `[[wikilinks]]` only when the relationship improves understanding, and do not create supporting pages merely to make the graph look complete.

Do not assess or debate the truthfulness of claims or materials supplied by Matej; treat them as accepted truths within the knowledge base. Do not invent citations, mechanisms, equations, or conclusions; when a claim needs evidence, request a source or state clearly that it remains unverified. Here, unverified refers only to whether a source has been supplied, not whether the claim is true.

Use plain Markdown by default. Do not add frontmatter, tags, aliases, templates, indexes, dashboards, generated files, scripts, or automation unless Matej explicitly approves that specific addition.

Follow Matej’s requested scope and format literally. A request for a title and two paragraphs authorizes only that title and those two paragraphs; do not add headings, prompts, questions, summaries, or other surrounding content without separate approval.

When editing an existing note, change only the approved passage and preserve all surrounding text, links, and formatting. Do not reorganize, rename, or clean up adjacent material unless that work is separately approved.

When Matej supplies a document, image, dataset, or other source, preserve the original unchanged. Do not relocate, rename, summarize, extract, or create derived notes from it unless the specific operation and destination have been approved.

## Query

When Matej asks a question about the vault, search `Notes/` first and consult `Sources/` and `Raw/` only as needed. Answer from the material present, identify the exact vault files supporting the answer, and state plainly when the vault does not contain enough material to answer. A query is read-only by default. If it reveals a useful missing note, connection, or passage-level edit, propose that exact change and wait for approval; do not write the answer into the vault automatically.

## Structural review

When Matej asks for a structural review, work read-only. Check for unresolved wikilinks, duplicate or overlapping pages, pages containing more than one primary idea, unlinked notes, missing reciprocal links between source notes and knowledge nodes, pending or draft sources, and whether `Home.md` reflects the current knowledge nodes. Surface useful missing connections and differing claims as proposals or tensions, not as facts to reconcile. Report the evidence and propose the smallest exact file-level or passage-level batch; do not modify the vault until Matej approves it.

## Source ingestion

`Raw/` contains the original materials supplied or clipped into the vault. Preserve every raw file unchanged after capture. `Sources/` contains editable Markdown source notes derived from those materials, while `Notes/` contains editable knowledge nodes. Only the raw material is immutable; source notes and knowledge nodes remain living documents that Matej and approved agents may revise.

A raw file is pending when no source note links to its exact vault-relative path, and a linked source remains pending work while its state is `draft`. Every source note must contain an `**Raw:** [[Raw/exact filename]]` line and an `**State:** draft` or `**State:** integrated` line. `draft` means that processing is incomplete. Set a source to `integrated` only after its summary is complete and every approved knowledge-note change has been applied; if the source produces no knowledge-note changes, that outcome must be part of the approved mapping. These states describe workflow progress, not the truthfulness or scientific quality of the material.

When Matej asks to map a source or pending sources, work read-only. Read each source completely, check exact raw links and original URLs for duplicates, search existing source notes and knowledge nodes, and propose the exact source page, note creations or edits, connections, and tensions for one batch approval. Do not create a skeleton or modify the vault during mapping.

After Matej approves the mapped batch, create or update only the listed files. A source note uses plain Markdown: its title, the exact `Raw` link, the original URL when available, its state, a concise `## Summary`, and `## Connected notes` only when meaningful connections exist. Every knowledge node that uses the source must include a `## Sources` section linking to the source note. Do not update `Home.md` unless that change was included explicitly in the approved batch.

Never regenerate or replace an existing source note or knowledge node wholesale. Read its current content and apply only the approved passage-level changes. Treat Matej's edits as authoritative, do not restore text he removed, and preserve differing claims or interpretations as tensions unless he approves a resolution. If the same material is clipped again, report the duplicate and do not merge, replace, rename, or delete either capture without approval.

During ingestion, mark a source `integrated` last. Verify that raw files remain unchanged, every raw and source link resolves, only the approved files changed, and all completed source and knowledge-note edits are reported.

Use the titles, terminology, symbols, spelling, and capitalization Matej provides. Do not rename, normalize, translate, pluralize, or add aliases unless that specific change is separately approved.

When an approved change cannot be completed without a missing decision, source, or destination, stop and ask a focused question. Do not fill the gap by guessing, browsing for substitute material, or expanding the approved scope.

Mechanical edits may correct formatting, broken links, and indexes. They must not reconcile or erase differing claims, interpretations, terminology, or instructions; preserve those tensions and surface them to Matej unless he explicitly approves a resolution.

After completing an approved change, verify the result and list every file changed. Include any mechanical edits in the report so Matej can distinguish the approved content change from supporting maintenance.
