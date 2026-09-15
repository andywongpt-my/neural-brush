# Neural Brush MaleCNS Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a reproducible, attributed, compact `male-cns:v1.0` circuit asset and a tested browser loader without shipping the full MaleCNS graph.

**Architecture:** Use `natverse/malecns` in an offline R exporter to query a deterministic DNa01/DNa02-centered upstream subgraph from public neuPrint. Export a human-auditable raw JSON snapshot, then use a TypeScript packer to generate browser assets: metadata/manifest JSON plus a compact binary edge table. The app never needs R or neuPrint at runtime.

**Tech Stack:** R, `malecns`, `neuprintr`, `jsonlite`, TypeScript, Node/tsx, Vitest

**Spec:** `docs/superpowers/specs/2026-09-15-neural-brush-design.md`

## Global Constraints

- Dataset is exactly `male-cns:v1.0` for V1.
- Preserve body IDs, directed topology, source weights, annotations, and neurotransmitter predictions as read-only source data.
- The browser must not download or simulate the complete approximately 1.1 GB MaleCNS connection table.
- Target committed compact neural data payload is **<= 10 MB** before normal HTTP compression.
- User modulation is not written into source data.
- The sensory adapter boundary is synthetic/modeling logic and must not be presented as a native MaleCNS sensory pathway.
- MaleCNS-derived distributed assets retain upstream CC-BY attribution; the MIT license applies only to original Neural Brush code.

---

### Task 1: Define the versioned circuit source and portable schemas

**Files:**
- Create: `src/brain/CircuitTypes.ts`
- Create: `tools/malecns-export/circuit-selection.json`
- Create: `tools/malecns-export/raw-schema.md`
- Create: `tests/unit/CircuitTypes.test.ts`

**Interfaces:**
- Produces: `CircuitMetadata`, `CircuitManifest`, `CircuitNeuron`, `BehaviorPorts` TypeScript interfaces.
- Raw exporter output: `tools/malecns-export/out/raw-circuit.json`.
- Browser outputs: `public/data/male-cns-v1/metadata.json`, `manifest.json`, `circuit.bin`.

- [ ] **Step 1: Write a failing schema invariant test**

```ts
// tests/unit/CircuitTypes.test.ts
import { describe, expect, it } from 'vitest';
import { CIRCUIT_SCHEMA_VERSION, DATASET_ID } from '../../src/brain/CircuitTypes';

describe('circuit schema constants', () => {
  it('pins the V1 dataset and schema', () => {
    expect(DATASET_ID).toBe('male-cns:v1.0');
    expect(CIRCUIT_SCHEMA_VERSION).toBe(1);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run tests/unit/CircuitTypes.test.ts`

Expected: FAIL because `CircuitTypes` does not exist.

- [ ] **Step 3: Define exact runtime types**

```ts
// src/brain/CircuitTypes.ts
export const DATASET_ID = 'male-cns:v1.0' as const;
export const CIRCUIT_SCHEMA_VERSION = 1 as const;

export type SomaSide = 'L' | 'R' | 'M' | 'unknown';

export interface CircuitNeuron {
  bodyId: string;
  type: string | null;
  instance: string | null;
  somaSide: SomaSide;
  neurotransmitter: string | null;
  inputPort: boolean;
  descendingSeed: boolean;
}

export interface BehaviorPorts {
  turnLeft: string[];
  turnRight: string[];
  forward: string[];
}

export interface CircuitMetadata {
  schema: 1;
  dataset: 'male-cns:v1.0';
  circuit: 'dna-steering-v1';
  neurons: CircuitNeuron[];
  behaviorPorts: BehaviorPorts;
}

export interface CircuitManifest {
  schema: 1;
  dataset: 'male-cns:v1.0';
  circuit: 'dna-steering-v1';
  generatedAt: string;
  source: 'neuprint.janelia.org';
  seedSelectors: ['DNa01', 'DNa02'];
  neuronCount: number;
  edgeCount: number;
  rawSha256: string;
  binarySha256: string;
}
```

`bodyId` is a decimal string in JSON to prevent accidental precision loss across non-JavaScript tools.

- [ ] **Step 4: Add deterministic selection configuration**

```json
{
  "dataset": "male-cns:v1.0",
  "circuit": "dna-steering-v1",
  "seedTypes": ["DNa01", "DNa02"],
  "firstHop": { "partners": "inputs", "threshold": 5, "maxPartners": 64 },
  "secondHop": { "partners": "inputs", "threshold": 10, "maxPartners": 96 },
  "internalEdgeThreshold": 1
}
```

Document in `raw-schema.md` that this circuit is a **DNa steering-centered upstream subgraph**. Local photo features are later injected through a synthetic sensory adapter at automatically detected frontier input ports; do not call every frontier neuron a retinal/visual neuron.

- [ ] **Step 5: Run test and commit**

Run: `npm test -- --run tests/unit/CircuitTypes.test.ts`

Expected: PASS.

```bash
git add src/brain tools/malecns-export tests/unit/CircuitTypes.test.ts

git commit -m "feat: define MaleCNS circuit schema"
```

---

### Task 2: Implement the reproducible `malecns` R exporter

**Files:**
- Create: `tools/malecns-export/export.R`
- Create: `tools/malecns-export/README.md`
- Create: `tools/malecns-export/.gitignore`

**Interfaces:**
- Consumes: environment variable `neuprint_token` as supported by `malecns`/`neuprintr`.
- Consumes: `tools/malecns-export/circuit-selection.json`.
- Produces: `tools/malecns-export/out/raw-circuit.json`.
- Raw JSON contains `dataset`, `circuit`, `selection`, `neurons[]`, `edges[]`.

- [ ] **Step 1: Add exporter preflight and config parsing**

At the top of `export.R`:

```r
suppressPackageStartupMessages({
  library(malecns)
  library(dplyr)
  library(jsonlite)
})

if (!nzchar(Sys.getenv('neuprint_token'))) {
  stop('neuprint_token is required; obtain it from neuprint.janelia.org and set it in .Renviron')
}

config <- jsonlite::fromJSON('tools/malecns-export/circuit-selection.json', simplifyVector = TRUE)
stopifnot(config$dataset == 'male-cns:v1.0')
choose_mcns_dataset(config$dataset)
```

Do not print the token.

- [ ] **Step 2: Query and validate DNa01/DNa02 seed neurons**

Use:

```r
seed_meta <- bind_rows(lapply(config$seedTypes, function(type) {
  mcns_neuprint_meta(type)
})) %>% distinct(bodyid, .keep_all = TRUE)

if (nrow(seed_meta) < 2) stop('Expected at least two DNa01/DNa02 seed neurons')
seed_ids <- seed_meta$bodyid
```

Log the number of seed neurons and their types/body IDs, but no credentials.

- [ ] **Step 3: Expand two deterministic incoming hops**

Implement helper:

```r
top_partners <- function(ids, threshold, max_partners) {
  if (length(ids) == 0) return(numeric())
  mcns_connection_table(
    ids,
    partners = 'inputs',
    threshold = threshold,
    summary = FALSE,
    moredetails = FALSE
  ) %>%
    arrange(desc(weight), partner) %>%
    distinct(partner, .keep_all = TRUE) %>%
    slice_head(n = max_partners) %>%
    pull(partner)
}
```

Then:

```r
hop1 <- top_partners(seed_ids, config$firstHop$threshold, config$firstHop$maxPartners)
hop2 <- top_partners(hop1, config$secondHop$threshold, config$secondHop$maxPartners)
selected_ids <- sort(unique(c(seed_ids, hop1, hop2)))
```

This makes selection stable given a fixed upstream dataset snapshot and explicit tie ordering by `partner`.

- [ ] **Step 4: Fetch all internal edges and metadata**

```r
all_outputs <- mcns_connection_table(
  selected_ids,
  partners = 'outputs',
  threshold = config$internalEdgeThreshold,
  summary = FALSE,
  moredetails = FALSE
)

internal_edges <- all_outputs %>%
  filter(partner %in% selected_ids) %>%
  transmute(
    source = as.character(bodyid),
    target = as.character(partner),
    weight = as.integer(weight)
  ) %>%
  arrange(source, target)

meta <- mcns_neuprint_meta(selected_ids) %>%
  mutate(bodyId = as.character(bodyid)) %>%
  arrange(bodyid)
```

Normalize missing `type`, `instance`, `somaSide`, and neurotransmitter fields to `NA` rather than inventing values.

- [ ] **Step 5: Mark deterministic input/frontier and behavior roles**

Define frontier neurons as selected nodes with no selected incoming edge:

```r
has_internal_incoming <- unique(internal_edges$target)
input_ports <- setdiff(as.character(selected_ids), has_internal_incoming)
```

Define descending seeds using type membership `DNa01`/`DNa02`. Derive left/right behavior candidates from seed metadata `somaSide`; if no left or right seed can be identified, stop with an error rather than guessing. `forward` is the union of all seed body IDs; V1 later documents forward as an aggregate modeling readout.

- [ ] **Step 6: Write stable raw JSON and README reproduction commands**

Write with `auto_unbox=TRUE`, `digits=NA`, `pretty=TRUE`, and arrays explicitly represented. README commands:

```bash
R -q -e 'install.packages("natmanager"); natmanager::install(pkgs="natverse/malecns")'
R -q -e 'install.packages("jsonlite")'
Rscript tools/malecns-export/export.R
```

README must say `neuprint_token` belongs in `.Renviron` or process environment and must never be committed.

- [ ] **Step 7: Execute exporter against `male-cns:v1.0` and inspect invariants**

Run:

```bash
Rscript tools/malecns-export/export.R
```

Expected:

- output JSON exists,
- `dataset == "male-cns:v1.0"`,
- all edge endpoints are present in `neurons`,
- all edge weights are positive integers,
- both left and right turn seed groups are non-empty,
- no token appears in output.

Commit exporter code but not `out/` yet:

```bash
git add tools/malecns-export

git commit -m "feat: add reproducible MaleCNS exporter"
```

---

### Task 3: Pack the raw graph into compact browser assets

**Files:**
- Modify: `package.json`
- Create: `tools/malecns-export/pack.ts`
- Create: `tools/malecns-export/hash.ts`
- Create: `tests/fixtures/raw-circuit.fixture.json`
- Create: `tests/unit/CircuitPacker.test.ts`

**Interfaces:**
- Produces: `packCircuit(raw): { metadata: CircuitMetadata; binary: Uint8Array; manifestBase: Omit<CircuitManifest, 'generatedAt' | 'rawSha256' | 'binarySha256'> }`.
- `circuit.bin` format:
  - bytes 0..3: ASCII `NBC1`
  - uint16 LE schema version `1`
  - uint16 LE reserved `0`
  - uint32 LE edge count
  - repeated edge records: `sourceIndex:uint32`, `targetIndex:uint32`, `weight:uint32`
- Node order is exactly the order in `metadata.neurons`.

- [ ] **Step 1: Add `tsx` and write a failing binary-format test**

Add dev dependency `tsx` and script:

```json
"data:pack": "tsx tools/malecns-export/pack.ts"
```

Test:

```ts
import { describe, expect, it } from 'vitest';
import { packCircuit } from '../../tools/malecns-export/pack';
import fixture from '../fixtures/raw-circuit.fixture.json';

describe('packCircuit', () => {
  it('writes NBC1 and deterministic edge records', () => {
    const { binary } = packCircuit(fixture);
    expect(new TextDecoder().decode(binary.slice(0, 4))).toBe('NBC1');
    expect(new DataView(binary.buffer).getUint16(4, true)).toBe(1);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run tests/unit/CircuitPacker.test.ts`

Expected: FAIL because `packCircuit` does not exist.

- [ ] **Step 3: Implement deterministic packing**

`packCircuit` must:

1. sort neurons by numeric `BigInt(bodyId)`,
2. build `Map<bodyId,index>`,
3. sort edges by `(sourceIndex,targetIndex)`,
4. reject duplicate directed edges,
5. reject endpoints not in the node map,
6. reject non-positive or non-integer weights,
7. create the header plus 12-byte records using `DataView` little-endian methods.

The metadata JSON carries text fields and role arrays; the binary contains only the hot edge table.

- [ ] **Step 4: Generate SHA-256 hashes and output files**

Use Node `crypto.createHash('sha256')`. Generate:

```text
public/data/male-cns-v1/circuit.bin
public/data/male-cns-v1/metadata.json
public/data/male-cns-v1/manifest.json
```

`manifest.json` records raw and binary hashes, counts, dataset/circuit IDs, seeds, and UTC `generatedAt`.

- [ ] **Step 5: Run packer twice and prove deterministic content**

Run:

```bash
npm run data:pack
sha256sum public/data/male-cns-v1/circuit.bin public/data/male-cns-v1/metadata.json
npm run data:pack
sha256sum public/data/male-cns-v1/circuit.bin public/data/male-cns-v1/metadata.json
```

Expected: binary and metadata hashes are identical across runs from identical raw input. `manifest.generatedAt` may differ and is excluded from content determinism expectations.

- [ ] **Step 6: Enforce the 10 MB payload ceiling**

`pack.ts` must throw when `circuit.bin + metadata.json + manifest.json > 10 * 1024 * 1024` bytes.

Run fixture tests and real pack:

```bash
npm test -- --run tests/unit/CircuitPacker.test.ts
npm run data:pack
```

Expected: PASS.

- [ ] **Step 7: Commit packer and generated V1 assets**

```bash
git add package.json package-lock.json tools/malecns-export tests/fixtures tests/unit public/data/male-cns-v1

git commit -m "feat: pack MaleCNS circuit for browser runtime"
```

---

### Task 4: Implement the browser circuit loader and binary validation

**Files:**
- Create: `src/brain/CircuitLoader.ts`
- Create: `src/brain/CircuitGraph.ts`
- Create: `tests/unit/CircuitLoader.test.ts`

**Interfaces:**
- Produces: `CircuitGraph` with immutable `metadata`, `sourceWeights`, `edges`, and `indexByBodyId`.
- Produces: `CircuitLoader.decode(metadata: CircuitMetadata, binary: ArrayBuffer): CircuitGraph`.
- Produces: `CircuitLoader.load(baseUrl = './data/male-cns-v1/'): Promise<CircuitGraph>`.

- [ ] **Step 1: Write failing loader tests**

Tests must cover:

```ts
it('rejects a bad magic header', () => { /* mutate NBC1 -> XXXX */ });
it('rejects an edge count that does not match byte length', () => { /* mutate count */ });
it('rejects indices outside metadata.neurons', () => { /* mutate sourceIndex */ });
it('decodes a valid fixture and preserves raw weights', () => { /* expect exact weight */ });
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run tests/unit/CircuitLoader.test.ts`

Expected: FAIL because loader does not exist.

- [ ] **Step 3: Implement strict decoder**

Decoder checks exact magic, schema `1`, reserved `0`, byte length `12 + edgeCount * 12`, node indices, positive weights, and duplicate directed pairs. Freeze or otherwise expose source arrays through read-only interfaces so later modulation code cannot mutate them.

- [ ] **Step 4: Implement HTTP loading with explicit failures**

Fetch `metadata.json` and `circuit.bin` from the same versioned directory. On non-2xx response, throw an error naming the missing asset and status. Validate `metadata.dataset === 'male-cns:v1.0'` and `metadata.circuit === 'dna-steering-v1'` before decoding.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test -- --run tests/unit/CircuitLoader.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/brain tests/unit/CircuitLoader.test.ts

git commit -m "feat: load compact MaleCNS circuit assets"
```

---

### Task 5: Add source attribution and scientific circuit notes

**Files:**
- Create: `docs/data-attribution.md`
- Create: `docs/science.md`
- Modify: `README.md`

**Interfaces:**
- Documentation is the user-facing contract separating source connectome facts from Neural Brush modeling assumptions.

- [ ] **Step 1: Document dataset attribution**

`docs/data-attribution.md` must state:

- Dataset: MaleCNS `male-cns:v1.0`.
- Source project: Janelia FlyEM Male CNS Connectome.
- Upstream data license: CC-BY.
- Neural Brush extraction method: seed types DNa01/DNa02, deterministic two-hop incoming expansion using thresholds/caps in `circuit-selection.json`, internal edge closure.
- Distributed derived files: `circuit.bin`, `metadata.json`, `manifest.json`.
- Neural Brush MIT license does not relicense MaleCNS-derived data.

- [ ] **Step 2: Document the model boundary**

`docs/science.md` must clearly state:

- source topology/weights/identity are connectome-derived,
- circuit is a selected subgraph, not the full CNS,
- frontier `inputPort` is a Neural Brush adapter boundary,
- local photo features are synthetic external stimuli,
- later neural dynamics are simplified and not electrophysiological reconstruction,
- later brush effects are artistic outputs, not biological motor outputs.

- [ ] **Step 3: Link the docs from README and run final data checks**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
wc -c public/data/male-cns-v1/*
```

Expected: tests/build PASS and total compact data payload remains <= 10 MB.

- [ ] **Step 4: Commit**

```bash
git add docs README.md

git commit -m "docs: attribute MaleCNS data and modeling boundary"
```

---

## Plan 2 Completion Gate

Before starting Plan 3, verify:

- Real `male-cns:v1.0` exporter runs with a user-supplied neuPrint token.
- DNa01/DNa02 seed lookup succeeds and left/right seed groups are verified from source metadata rather than guessed.
- `circuit.bin`, `metadata.json`, and `manifest.json` are committed and <= 10 MB total.
- Browser loader rejects corrupt/mismatched assets.
- Raw source weights remain immutable at runtime.
- Data attribution and modeling-boundary documentation are present and linked.
