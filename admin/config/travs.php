<?php

return [
    'map_provider' => env('TRAVS_MAP_PROVIDER', 'openstreetmap'),
    'import_allowlist' => array_filter(array_map('trim', explode(',', env('TRAVS_IMPORT_ALLOWLIST', '')))),
    'duplicate_threshold' => 0.82,
    'review_required' => true,
];
