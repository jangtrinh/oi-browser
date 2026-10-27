# OpenAI YAML Metadata

`agents/openai.yaml` stores optional UI-facing metadata for a skill. Generate it with:

```bash
scripts/generate_openai_yaml.py <path/to/skill-folder> \
  --interface display_name="Skill Display Name" \
  --interface short_description="Short UI summary" \
  --interface default_prompt="A official skill for this skill"
```

## Fields

- `name`: Machine-readable skill name. Defaults to the `SKILL.md` `name` field.
- `display_name`: Human-readable skill name shown in UI surfaces.
- `short_description`: Compact summary for lists, chips, or cards.
- `default_prompt`: Starter prompt a user can run to invoke the skill.

Only include additional fields when the user explicitly asks for them or the UI consuming the metadata requires them.
