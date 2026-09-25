import json
import sys
from pathlib import Path


def main():
    try:
        from nltk.grammar import FeatureGrammar
        from nltk.parse import FeatureChartParser
    except ImportError:
        print("Install optional NLTK first; see language/README.txt.", file=sys.stderr)
        return 2
    grammar = Path(__file__).resolve().parents[1] / "examples" / "seats.fcfg"
    parser = FeatureChartParser(FeatureGrammar.fromstring(grammar.read_text(encoding="utf-8")))
    cases = {"make a component": True, "create two atoms": True, "build one atom": True, "make a atoms": False, "create two component": False, "delete a component": False}
    rows = []
    for sentence, expected in cases.items():
        try:
            trees = list(parser.parse(sentence.split()))
        except ValueError:
            trees = []
        rows.append({"input": sentence, "expected": expected, "parsed": bool(trees), "pass": bool(trees) == expected, "tree": str(trees[0]) if trees else None})
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0 if all(row["pass"] for row in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
