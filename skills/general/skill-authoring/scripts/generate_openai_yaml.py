#!/usr/bin/env python3
"""
Generate agents/openai.yaml metadata for a skill.

The file is intentionally small and dependency-light so it can be bundled with
the skill and used by Ổi Browser when creating new skills.
"""

import argparse
import re
import sys
from pathlib import Path

import yaml

SAFE_INTERFACE_KEY = re.compile(r"^[a-z][a-z0-9_-]*$")
FRONTMATTER_NAME = re.compile(r"^name:\s*([a-z0-9]+(?:-[a-z0-9]+)*)\s*$", re.MULTILINE)
FRONTMATTER_DESCRIPTION = re.compile(r"^description:\s*(.+?)\s*$", re.MULTILINE)


def title_case_skill_name(skill_name):
    return " ".join(word.capitalize() for word in skill_name.split("-"))


def first_sentence(text):
    stripped = " ".join(text.strip().split())
    if not stripped:
        return ""
    sentence_match = re.match(r"^(.+?[.!?])(?:\s|$)", stripped)
    if sentence_match:
        return sentence_match.group(1)
    return stripped


def read_skill_frontmatter(skill_dir):
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return {}

    content = skill_md.read_text(encoding="utf-8")
    name_match = FRONTMATTER_NAME.search(content)
    description_match = FRONTMATTER_DESCRIPTION.search(content)

    frontmatter = {}
    if name_match:
        frontmatter["name"] = name_match.group(1)
    if description_match:
        frontmatter["description"] = description_match.group(1).strip().strip("'\"")
    return frontmatter


def parse_interface_overrides(raw_overrides):
    overrides = {}
    for raw_override in raw_overrides:
        if "=" not in raw_override:
            print(f"[ERROR] Invalid --interface value '{raw_override}'. Use key=value.")
            return None

        key, value = raw_override.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not SAFE_INTERFACE_KEY.match(key):
            print(
                f"[ERROR] Invalid interface key '{key}'. Use lowercase letters, digits, hyphens, or underscores."
            )
            return None
        if not value:
            print(f"[ERROR] Interface value for '{key}' cannot be empty.")
            return None

        overrides[key] = value

    return overrides


def default_openai_metadata(skill_name, description):
    display_name = title_case_skill_name(skill_name)
    short_description = first_sentence(description)
    if not short_description:
        short_description = f"Use the {display_name} skill."

    return {
        "name": skill_name,
        "display_name": display_name,
        "short_description": short_description,
        "default_prompt": f"Help me use the {display_name} skill.",
    }


def write_openai_yaml(skill_dir, skill_name=None, interface_overrides=None):
    skill_dir = Path(skill_dir).resolve()
    frontmatter = read_skill_frontmatter(skill_dir)
    resolved_skill_name = skill_name or frontmatter.get("name") or skill_dir.name
    description = frontmatter.get("description", "")
    overrides = parse_interface_overrides(interface_overrides or [])
    if overrides is None:
        return False

    metadata = default_openai_metadata(resolved_skill_name, description)
    metadata.update(overrides)

    agents_dir = skill_dir / "agents"
    agents_dir.mkdir(exist_ok=True)
    openai_yaml = agents_dir / "openai.yaml"
    openai_yaml.write_text(
        yaml.safe_dump(metadata, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    print("[OK] Created agents/openai.yaml")
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate agents/openai.yaml for a skill.")
    parser.add_argument("skill_path", help="Path to the skill folder")
    parser.add_argument(
        "--interface",
        action="append",
        default=[],
        help="Interface override in key=value format (repeatable)",
    )
    args = parser.parse_args()

    skill_dir = Path(args.skill_path).resolve()
    if not skill_dir.exists():
        print(f"[ERROR] Skill directory does not exist: {skill_dir}")
        sys.exit(1)

    success = write_openai_yaml(skill_dir, interface_overrides=args.interface)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
