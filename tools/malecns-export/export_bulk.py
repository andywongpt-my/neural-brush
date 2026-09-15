#!/usr/bin/env python3
"""Build Neural Brush's compact raw circuit from the public MaleCNS v1.0 Feather snapshot.

This exporter deliberately keeps image/sensory mapping out of the connectome data. It only
selects a deterministic DNa01/DNa02-centred upstream subgraph and preserves source edge
weights plus source metadata. Photo features are injected later by Neural Brush's synthetic
sensory adapter.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

DATASET_ID = "male-cns:v1.0"
CIRCUIT_ID = "dna-steering-v1"
SEED_TYPES = ("DNa01", "DNa02")

DEFAULT_CACHE = Path("tools/malecns-export/cache")
DEFAULT_CONFIG = Path("tools/malecns-export/circuit-selection.json")
DEFAULT_OUTPUT = Path("tools/malecns-export/out/raw-circuit.json")
DEFAULT_ANNOTATIONS = DEFAULT_CACHE / "body-annotations-male-cns-v1.0-minconf-0.5.feather"
DEFAULT_NT = DEFAULT_CACHE / "body-neurotransmitters-male-cns-v1.0.feather"
DEFAULT_WEIGHTS = DEFAULT_CACHE / "connectome-weights-male-cns-v1.0-minconf-0.5.feather"

Row = Mapping[str, Any]


def _as_int(value: Any, field: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{field} must be an integer body/weight value")
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be an integer body/weight value: {value!r}") from exc
    return result


def choose_top_partners(
    rows: Iterable[Row],
    targets: set[int],
    *,
    threshold: int,
    max_partners: int,
) -> list[int]:
    """Choose deterministic incoming partners from already-materialized edge rows.

    Rows are expected to use MaleCNS bulk columns ``body_pre``, ``body_post`` and
    ``weight``. Ranking is descending source weight, then numeric source body ID, then
    target body ID. A presynaptic body can appear only once in the returned list.
    """

    if threshold < 1:
        raise ValueError("threshold must be >= 1")
    if max_partners < 1:
        raise ValueError("max_partners must be >= 1")

    candidates: list[tuple[int, int, int]] = []
    for row in rows:
        source = _as_int(row["body_pre"], "body_pre")
        target = _as_int(row["body_post"], "body_post")
        weight = _as_int(row["weight"], "weight")
        if target in targets and weight >= threshold:
            candidates.append((source, target, weight))

    candidates.sort(key=lambda item: (-item[2], item[0], item[1]))
    selected: list[int] = []
    seen: set[int] = set()
    for source, _target, _weight in candidates:
        if source in seen:
            continue
        seen.add(source)
        selected.append(source)
        if len(selected) >= max_partners:
            break
    return selected


def build_behavior_ports(seed_rows: Sequence[Row]) -> dict[str, list[str]]:
    left = sorted(
        str(_as_int(row["bodyId"], "bodyId"))
        for row in seed_rows
        if row.get("somaSide") == "L"
    )
    right = sorted(
        str(_as_int(row["bodyId"], "bodyId"))
        for row in seed_rows
        if row.get("somaSide") == "R"
    )
    if not left or not right:
        raise ValueError("DNa steering seeds must contain source-verified left and right soma sides")
    return {"turnLeft": left, "turnRight": right, "forward": []}


def choose_neurotransmitter(row: Mapping[str, Any] | None) -> str | None:
    if not row:
        return None
    for field in ("consensus_nt", "predicted_nt"):
        value = row.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _require_columns(table: Any, required: Sequence[str], label: str) -> None:
    missing = [name for name in required if name not in table.column_names]
    if missing:
        raise ValueError(
            f"{label} is missing required columns {missing}; available={table.column_names}",
        )


def _arrow_rows(table: Any) -> list[dict[str, Any]]:
    return table.to_pylist()


def _filter_incoming_rows(
    edges: Any,
    targets: set[int],
    threshold: int,
) -> list[dict[str, Any]]:
    import pyarrow as pa
    import pyarrow.compute as pc

    if not targets:
        return []
    target_values = pa.array(sorted(targets), type=edges["body_post"].type)
    target_mask = pc.is_in(edges["body_post"], value_set=target_values)
    weight_mask = pc.greater_equal(edges["weight"], threshold)
    return _arrow_rows(edges.filter(pc.and_(target_mask, weight_mask)))


def _filter_internal_edges(edges: Any, selected_ids: set[int], threshold: int) -> list[dict[str, int]]:
    import pyarrow as pa
    import pyarrow.compute as pc

    values_pre = pa.array(sorted(selected_ids), type=edges["body_pre"].type)
    values_post = pa.array(sorted(selected_ids), type=edges["body_post"].type)
    mask = pc.and_(
        pc.and_(
            pc.is_in(edges["body_pre"], value_set=values_pre),
            pc.is_in(edges["body_post"], value_set=values_post),
        ),
        pc.greater_equal(edges["weight"], threshold),
    )
    result: list[dict[str, int]] = []
    for row in _arrow_rows(edges.filter(mask)):
        result.append(
            {
                "source": _as_int(row["body_pre"], "body_pre"),
                "target": _as_int(row["body_post"], "body_post"),
                "weight": _as_int(row["weight"], "weight"),
            },
        )
    result.sort(key=lambda row: (row["source"], row["target"]))
    return result


def _filter_table_ids(table: Any, column: str, ids: set[int]) -> Any:
    import pyarrow as pa
    import pyarrow.compute as pc

    values = pa.array(sorted(ids), type=table[column].type)
    return table.filter(pc.is_in(table[column], value_set=values))


def _load_config(path: Path) -> dict[str, Any]:
    config = json.loads(path.read_text(encoding="utf-8"))
    if config.get("dataset") != DATASET_ID:
        raise ValueError(f"Expected config dataset {DATASET_ID!r}")
    if config.get("circuit") != CIRCUIT_ID:
        raise ValueError(f"Expected config circuit {CIRCUIT_ID!r}")
    if tuple(config.get("seedTypes", ())) != SEED_TYPES:
        raise ValueError(f"Expected seedTypes {list(SEED_TYPES)!r}")
    return config


def export_bulk(
    *,
    annotations_path: Path,
    neurotransmitters_path: Path,
    weights_path: Path,
    config_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    try:
        import pyarrow as pa
        import pyarrow.compute as pc
        import pyarrow.feather as feather
    except ImportError as exc:
        raise RuntimeError("pyarrow is required for the public MaleCNS bulk exporter") from exc

    config = _load_config(config_path)

    annotations = feather.read_table(
        annotations_path,
        columns=["bodyId", "type", "instance", "somaSide"],
        memory_map=True,
    )
    neurotransmitters = feather.read_table(
        neurotransmitters_path,
        columns=["body", "consensus_nt", "predicted_nt"],
        memory_map=True,
    )
    edges = feather.read_table(
        weights_path,
        columns=["body_pre", "body_post", "weight"],
        memory_map=True,
    )

    _require_columns(annotations, ["bodyId", "type", "instance", "somaSide"], "annotations")
    _require_columns(neurotransmitters, ["body", "consensus_nt", "predicted_nt"], "neurotransmitters")
    _require_columns(edges, ["body_pre", "body_post", "weight"], "connectome weights")

    seed_mask = pc.is_in(annotations["type"], value_set=pa.array(SEED_TYPES))
    seed_rows = _arrow_rows(annotations.filter(seed_mask))
    seed_ids = {_as_int(row["bodyId"], "bodyId") for row in seed_rows}
    if len(seed_ids) < 2:
        raise ValueError(f"Expected DNa01/DNa02 seed neurons, found {len(seed_ids)}")
    behavior_ports = build_behavior_ports(seed_rows)

    first = config["firstHop"]
    first_rows = _filter_incoming_rows(edges, seed_ids, int(first["threshold"]))
    hop1 = choose_top_partners(
        first_rows,
        seed_ids,
        threshold=int(first["threshold"]),
        max_partners=int(first["maxPartners"]),
    )

    second = config["secondHop"]
    hop1_set = set(hop1)
    second_rows = _filter_incoming_rows(edges, hop1_set, int(second["threshold"]))
    hop2 = choose_top_partners(
        second_rows,
        hop1_set,
        threshold=int(second["threshold"]),
        max_partners=int(second["maxPartners"]),
    )

    selected_ids = set(seed_ids) | set(hop1) | set(hop2)
    internal_edges = _filter_internal_edges(
        edges,
        selected_ids,
        int(config["internalEdgeThreshold"]),
    )
    incoming_targets = {edge["target"] for edge in internal_edges}
    input_ports = selected_ids - incoming_targets

    selected_annotations = _filter_table_ids(annotations, "bodyId", selected_ids)
    annotation_by_id = {
        _as_int(row["bodyId"], "bodyId"): row for row in _arrow_rows(selected_annotations)
    }
    selected_nt = _filter_table_ids(neurotransmitters, "body", selected_ids)
    nt_by_id = {_as_int(row["body"], "body"): row for row in _arrow_rows(selected_nt)}

    neurons: list[dict[str, Any]] = []
    for body_id in sorted(selected_ids):
        annotation = annotation_by_id.get(body_id, {})
        neurons.append(
            {
                "bodyId": str(body_id),
                "type": annotation.get("type"),
                "instance": annotation.get("instance"),
                "somaSide": annotation.get("somaSide"),
                "neurotransmitter": choose_neurotransmitter(nt_by_id.get(body_id)),
                "inputPort": body_id in input_ports,
                "descendingSeed": body_id in seed_ids,
            },
        )

    raw = {
        "dataset": DATASET_ID,
        "circuit": CIRCUIT_ID,
        "selection": {
            "source": "MaleCNS v1.0 public bulk Feather snapshot",
            "seedTypes": list(SEED_TYPES),
            "firstHop": first,
            "secondHop": second,
            "internalEdgeThreshold": config["internalEdgeThreshold"],
        },
        "neurons": neurons,
        "edges": [
            {
                "source": str(edge["source"]),
                "target": str(edge["target"]),
                "weight": edge["weight"],
            }
            for edge in internal_edges
        ],
        "behaviorPorts": behavior_ports,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(raw, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return raw


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--annotations", type=Path, default=DEFAULT_ANNOTATIONS)
    parser.add_argument("--neurotransmitters", type=Path, default=DEFAULT_NT)
    parser.add_argument("--weights", type=Path, default=DEFAULT_WEIGHTS)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    raw = export_bulk(
        annotations_path=args.annotations,
        neurotransmitters_path=args.neurotransmitters,
        weights_path=args.weights,
        config_path=args.config,
        output_path=args.output,
    )
    print(
        f"Exported {len(raw['neurons'])} neurons and {len(raw['edges'])} internal edges "
        f"from {DATASET_ID}",
    )


if __name__ == "__main__":
    main()
