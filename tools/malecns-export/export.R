suppressPackageStartupMessages({
  library(malecns)
  library(dplyr)
  library(jsonlite)
})

CONFIG_PATH <- 'tools/malecns-export/circuit-selection.json'
OUTPUT_DIR <- 'tools/malecns-export/out'
OUTPUT_PATH <- file.path(OUTPUT_DIR, 'raw-circuit.json')
EXPECTED_DATASET <- 'male-cns:v1.0'

neuprint_token <- Sys.getenv('neuprint_token')
if (!nzchar(neuprint_token)) {
  stop('neuprint_token is required; obtain it from neuprint.janelia.org and set it in .Renviron')
}

if (!file.exists(CONFIG_PATH)) {
  stop(sprintf('Missing selection config: %s', CONFIG_PATH))
}

config <- jsonlite::fromJSON(CONFIG_PATH, simplifyVector = TRUE)
if (!identical(config$dataset, EXPECTED_DATASET)) {
  stop(sprintf('Expected dataset %s, got %s', EXPECTED_DATASET, config$dataset))
}
if (!identical(config$circuit, 'dna-steering-v1')) {
  stop(sprintf('Unexpected circuit id: %s', config$circuit))
}

choose_mcns_dataset(config$dataset)
conn <- mcns_neuprint(token = neuprint_token, dataset = config$dataset)

seed_meta <- bind_rows(lapply(config$seedTypes, function(type) {
  mcns_neuprint_meta(type, conn = conn)
})) %>%
  distinct(bodyid, .keep_all = TRUE)

if (nrow(seed_meta) < 2) {
  stop('Expected at least two DNa01/DNa02 seed neurons')
}
seed_ids <- seed_meta$bodyid
message(sprintf(
  'Resolved %d seed neurons: %s',
  length(seed_ids),
  paste(sprintf('%s:%s', seed_meta$type, as.character(seed_meta$bodyid)), collapse = ', ')
))

top_partners <- function(ids, threshold, max_partners) {
  if (length(ids) == 0) return(numeric())

  mcns_connection_table(
    ids,
    partners = 'inputs',
    threshold = threshold,
    summary = FALSE,
    moredetails = FALSE,
    conn = conn
  ) %>%
    arrange(desc(weight), partner) %>%
    distinct(partner, .keep_all = TRUE) %>%
    slice_head(n = max_partners) %>%
    pull(partner)
}

hop1 <- top_partners(
  seed_ids,
  config$firstHop$threshold,
  config$firstHop$maxPartners
)
hop2 <- top_partners(
  hop1,
  config$secondHop$threshold,
  config$secondHop$maxPartners
)
selected_ids <- sort(unique(c(seed_ids, hop1, hop2)))

if (length(selected_ids) == 0) {
  stop('Circuit selection produced no neurons')
}

all_outputs <- mcns_connection_table(
  selected_ids,
  partners = 'outputs',
  threshold = config$internalEdgeThreshold,
  summary = FALSE,
  moredetails = FALSE,
  conn = conn
)

internal_edges <- all_outputs %>%
  filter(partner %in% selected_ids) %>%
  transmute(
    source = as.character(bodyid),
    target = as.character(partner),
    weight = as.integer(weight)
  ) %>%
  arrange(source, target)

meta <- mcns_neuprint_meta(selected_ids, conn = conn) %>%
  arrange(bodyid)

for (column in c('type', 'instance', 'somaSide', 'predictedNt')) {
  if (!column %in% colnames(meta)) meta[[column]] <- NA_character_
}

meta <- meta %>%
  mutate(
    bodyId = as.character(bodyid),
    type = as.character(type),
    instance = as.character(instance),
    somaSide = as.character(somaSide),
    predictedNt = as.character(predictedNt)
  )

selected_id_strings <- as.character(selected_ids)
has_internal_incoming <- unique(internal_edges$target)
input_ports <- setdiff(selected_id_strings, has_internal_incoming)

neurons <- meta %>%
  transmute(
    bodyId,
    type,
    instance,
    somaSide,
    neurotransmitter = predictedNt,
    inputPort = bodyId %in% input_ports,
    descendingSeed = type %in% config$seedTypes
  )

seed_roles <- neurons %>% filter(descendingSeed)
missing_seed_types <- setdiff(config$seedTypes, unique(seed_roles$type))
if (length(missing_seed_types) > 0) {
  stop(sprintf(
    'Seed metadata is missing expected types: %s',
    paste(missing_seed_types, collapse = ', ')
  ))
}

turn_left <- seed_roles$bodyId[seed_roles$somaSide == 'L']
turn_right <- seed_roles$bodyId[seed_roles$somaSide == 'R']
forward <- seed_roles$bodyId

if (length(turn_left) == 0 || length(turn_right) == 0) {
  stop('Could not verify both left and right DNa01/DNa02 seed groups from source somaSide metadata')
}

node_ids <- neurons$bodyId
if (anyDuplicated(node_ids)) {
  stop('Duplicate neuron body IDs in selected metadata')
}
if (!all(internal_edges$source %in% node_ids) || !all(internal_edges$target %in% node_ids)) {
  stop('Internal edge references a neuron outside the selected metadata')
}
if (nrow(internal_edges) > 0 && any(
  is.na(internal_edges$weight) |
    internal_edges$weight <= 0 |
    internal_edges$weight != floor(internal_edges$weight)
)) {
  stop('All internal edge weights must be positive integers')
}

selection_output <- config
selection_output$seedTypes <- I(as.character(config$seedTypes))

raw_circuit <- list(
  dataset = config$dataset,
  circuit = config$circuit,
  selection = selection_output,
  neurons = neurons,
  edges = internal_edges,
  behaviorPorts = list(
    turnLeft = I(as.character(turn_left)),
    turnRight = I(as.character(turn_right)),
    forward = I(as.character(forward))
  )
)

dir.create(OUTPUT_DIR, recursive = TRUE, showWarnings = FALSE)
jsonlite::write_json(
  raw_circuit,
  OUTPUT_PATH,
  auto_unbox = TRUE,
  digits = NA,
  pretty = TRUE,
  na = 'null',
  dataframe = 'rows'
)

message(sprintf(
  'Wrote %s (%d neurons, %d internal edges, %d frontier input ports)',
  OUTPUT_PATH,
  nrow(neurons),
  nrow(internal_edges),
  length(input_ports)
))
