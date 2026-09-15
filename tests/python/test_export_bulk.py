from __future__ import annotations

import sys
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[2] / "tools" / "malecns-export"
sys.path.insert(0, str(TOOLS))

from export_bulk import (  # type: ignore[import-not-found]  # noqa: E402
    build_behavior_ports,
    choose_neurotransmitter,
    choose_top_partners,
)


class BulkExporterTests(unittest.TestCase):
    def test_choose_top_partners_is_weight_then_body_deterministic(self) -> None:
        rows = [
            {"body_pre": 10, "body_post": 100, "weight": 5},
            {"body_pre": 11, "body_post": 100, "weight": 9},
            {"body_pre": 10, "body_post": 200, "weight": 8},
            {"body_pre": 12, "body_post": 100, "weight": 9},
            {"body_pre": 99, "body_post": 999, "weight": 100},
        ]

        self.assertEqual(
            choose_top_partners(rows, {100, 200}, threshold=5, max_partners=2),
            [11, 12],
        )

    def test_behavior_ports_use_source_soma_side_and_do_not_invent_forward(self) -> None:
        seeds = [
            {"bodyId": 10360, "type": "DNa02", "somaSide": "R"},
            {"bodyId": 10442, "type": "DNa01", "somaSide": "L"},
            {"bodyId": 10760, "type": "DNa01", "somaSide": "R"},
            {"bodyId": 523769, "type": "DNa02", "somaSide": "L"},
        ]

        self.assertEqual(
            build_behavior_ports(seeds),
            {
                "turnLeft": ["10442", "523769"],
                "turnRight": ["10360", "10760"],
                "forward": [],
            },
        )

    def test_behavior_ports_fail_closed_when_a_steering_side_is_missing(self) -> None:
        with self.assertRaisesRegex(ValueError, "left and right"):
            build_behavior_ports(
                [{"bodyId": 10360, "type": "DNa02", "somaSide": "R"}],
            )

    def test_consensus_neurotransmitter_wins_over_prediction(self) -> None:
        self.assertEqual(
            choose_neurotransmitter(
                {"consensus_nt": "acetylcholine", "predicted_nt": "gaba"},
            ),
            "acetylcholine",
        )
        self.assertEqual(
            choose_neurotransmitter(
                {"consensus_nt": None, "predicted_nt": "gaba"},
            ),
            "gaba",
        )


if __name__ == "__main__":
    unittest.main()
