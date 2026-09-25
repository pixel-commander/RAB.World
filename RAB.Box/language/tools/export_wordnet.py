import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Export selected WordNet senses as review-only data. Never downloads implicitly.")
    parser.add_argument("words", nargs="+", help="Words to inspect, not executable capability names")
    parser.add_argument("--data-dir", type=Path)
    parser.add_argument("--pos", choices=["n", "v", "a", "r"])
    parser.add_argument("--max-senses", type=int, default=6)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.max_senses <= 30 or len(args.words) > 100:
        parser.error("Use 1–30 senses and at most 100 input words.")
    try:
        import nltk
        if args.data_dir:
            nltk.data.path.insert(0, str(args.data_dir.resolve()))
        from nltk.corpus import wordnet as wn
        version = wn.get_version()
        entries = {}
        for word in args.words:
            for sense in wn.synsets(word.lower(), pos=args.pos)[:args.max_senses]:
                key = f"{word.lower()}:{sense.name()}"
                entries[key] = {
                    "id": key,
                    "word": word,
                    "part_of_speech": sense.pos(),
                    "sense": sense.name(),
                    "forms": sorted(set(lemma.replace("_", " ") for lemma in sense.lemma_names())),
                    "definition": sense.definition(),
                    "examples": sense.examples()[:20],
                }
        data = {
            "format": "rraabbiitt-language-resource/v1",
            "source": {
                "name": f"Princeton WordNet {version} via NLTK {nltk.__version__}",
                "url": "https://wordnet.princeton.edu/",
                "license": "Princeton WordNet license; retain the matching license with redistributed exports.",
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "input_words": args.words,
                "selection": f"First {args.max_senses} returned senses per word; not a frequency ranking or an exhaustive vocabulary.",
            },
            "entries": list(entries.values()),
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        print(f"Exported {len(entries)} review-only entries to {args.output}")
    except (ImportError, LookupError):
        print("NLTK or WordNet is not installed. See language/README.txt for explicit setup commands. No download was attempted.", file=sys.stderr)
        return 2
    except (OSError, ValueError) as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
