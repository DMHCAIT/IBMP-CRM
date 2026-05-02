"""
Input sanitization utilities.

Strips HTML tags and potentially dangerous characters from free-text user
inputs before they are stored in the database or rendered in the frontend.

Why: Free-text fields (notes, names, next_action) can contain XSS payloads
that surface in React's dangerouslySetInnerHTML or Ant Design tooltips.
Stripping tags at the API boundary is a defense-in-depth measure.
"""

import re
import html

# Pattern matching any HTML tag (<script>, <img>, <a href=...> etc.)
_HTML_TAG_RE = re.compile(r'<[^>]*?>', re.DOTALL)

# Characters that have no legitimate use in notes/names but are used in
# injection attacks: null bytes, form feeds, etc.
_CONTROL_CHAR_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')


def strip_html(value: str | None) -> str | None:
    """
    Remove HTML tags and decode HTML entities from a string.
    Returns None unchanged so Optional fields stay optional.
    """
    if value is None:
        return None
    # Decode entities first so &lt;script&gt; → <script> is also caught
    decoded = html.unescape(str(value))
    # Remove tags
    cleaned = _HTML_TAG_RE.sub('', decoded)
    # Remove dangerous control characters
    cleaned = _CONTROL_CHAR_RE.sub('', cleaned)
    return cleaned.strip()


def sanitize_text(value: str | None, max_length: int | None = None) -> str | None:
    """
    Full sanitization: strip HTML, trim whitespace, enforce max_length.
    Use this for all free-text fields that are displayed in the UI.
    """
    cleaned = strip_html(value)
    if cleaned is not None and max_length is not None:
        cleaned = cleaned[:max_length]
    return cleaned
