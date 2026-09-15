from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "generate-malecns-assets.yml"


class GenerationWorkflowTests(unittest.TestCase):
    def test_generation_workflow_survives_merge_to_main(self) -> None:
        text = WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("      - main\n", text)
        self.assertIn("      - feature/malecns-data-pipeline\n", text)
        self.assertIn("          ref: ${{ github.ref_name }}\n", text)
        self.assertIn('git push origin "HEAD:${GITHUB_REF_NAME}"', text)
        self.assertNotIn("          ref: feature/malecns-data-pipeline\n", text)
        self.assertNotIn("HEAD:feature/malecns-data-pipeline", text)

    def test_asset_commit_is_reproducible_and_race_safe(self) -> None:
        text = WORKFLOW.read_text(encoding="utf-8")

        self.assertIn(
            'NEURAL_BRUSH_GENERATED_AT=$(git show -s --format=%cI HEAD)',
            text,
        )
        self.assertIn('git fetch origin "$GITHUB_REF_NAME"', text)
        self.assertIn('git rebase "origin/$GITHUB_REF_NAME"', text)


if __name__ == "__main__":
    unittest.main()
