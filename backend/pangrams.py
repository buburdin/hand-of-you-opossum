"""Collection of English pangrams for handwriting capture."""

PANGRAMS = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "The five boxing wizards jump quickly",
    "Jackdaws love my big sphinx of quartz",
    "Crazy Frederick bought many very exquisite opal jewels",
    "We promptly judged antique ivory buckles for the next prize",
    "A quick movement of the enemy will jeopardize six gunboats",
    "The job requires extra pluck and zeal from every young wage earner",
    "Just keep examining every low bid quoted for zinc etchings",
]


def get_unique_chars(pangram: str) -> list[str]:
    """Extract unique alphabetic characters from a pangram, preserving order of first appearance."""
    seen: set[str] = set()
    chars: list[str] = []
    for c in pangram:
        lower = c.lower()
        if lower.isalpha() and lower not in seen:
            seen.add(lower)
            chars.append(lower)
    return chars
