"""Knowledge-base loading and heading-aware chunking.

Articles are Markdown with YAML front matter. Chunks follow `##` sections, so each one is a
coherent unit ("Risks and side effects" of veneers), and long sections are packed by paragraph.
Every chunk carries a contextual header (`Article › Section`) that is embedded and indexed with
the text. This cheap form of contextual retrieval lets a bare "Risks" section still match a query
about veneers.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

_FRONT_MATTER = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
_SECTION = re.compile(r"^## +(.+)$", re.MULTILINE)
_SOURCE = re.compile(r"^(?P<label>.+?):\s*(?P<url>https?://\S+)$")


@dataclass(frozen=True, slots=True)
class Source:
    label: str
    url: str | None


@dataclass(frozen=True, slots=True)
class Document:
    slug: str
    title: str
    body: str
    sources: tuple[Source, ...] = ()

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.body.encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class Chunk:
    id: str
    doc_slug: str
    doc_title: str
    heading: str
    text: str
    ordinal: int
    sources: tuple[Source, ...] = field(default=())

    @property
    def contextual_text(self) -> str:
        return f"{self.doc_title} › {self.heading}\n{self.text}"


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_document(raw: str, *, fallback_slug: str) -> Document:
    meta: dict = {}
    if m := _FRONT_MATTER.match(raw):
        meta = yaml.safe_load(m.group(1)) or {}
        raw = raw[m.end() :]
    sources = []
    for item in meta.get("sources", []):
        if isinstance(item, dict):  # YAML reads "- Label: https://..." as a one-key mapping
            sources += [Source(str(label).strip(), str(url)) for label, url in item.items()]
        elif sm := _SOURCE.match(str(item)):
            sources.append(Source(sm["label"].strip(), sm["url"]))
        else:
            sources.append(Source(str(item), None))
    return Document(
        slug=meta.get("slug", fallback_slug),
        title=meta.get("title", fallback_slug.replace("-", " ").title()),
        body=raw.strip(),
        sources=tuple(sources),
    )


def load_documents(directory: Path) -> list[Document]:
    return [parse_document(p.read_text(), fallback_slug=p.stem) for p in sorted(directory.glob("*.md"))]


def chunk_document(doc: Document, *, max_chars: int = 1200) -> list[Chunk]:
    parts = _SECTION.split(doc.body)
    # parts = [preamble, heading1, body1, heading2, body2, ...]
    sections: list[tuple[str, str]] = []
    preamble = re.sub(r"^# .+\n?", "", parts[0]).strip()
    if preamble:
        sections.append(("Overview", preamble))
    sections += [(parts[i].strip(), parts[i + 1].strip()) for i in range(1, len(parts) - 1, 2)]

    chunks: list[Chunk] = []
    for heading, body in sections:
        buf: list[str] = []
        pieces: list[str] = []
        for para in (p.strip() for p in body.split("\n\n") if p.strip()):
            if buf and sum(len(b) for b in buf) + len(para) > max_chars:
                pieces.append("\n\n".join(buf))
                buf = []
            buf.append(para)
        if buf:
            pieces.append("\n\n".join(buf))
        for n, text in enumerate(pieces):
            suffix = f"-{n + 1}" if len(pieces) > 1 else ""
            chunks.append(
                Chunk(
                    id=f"{doc.slug}#{_slugify(heading)}{suffix}",
                    doc_slug=doc.slug,
                    doc_title=doc.title,
                    heading=heading,
                    text=text,
                    ordinal=len(chunks),
                    sources=doc.sources,
                )
            )
    return chunks
