<?php

return [
    'image_roots' => [
        public_path('images'),
        env('PRODUCT_PDF_FRONTEND_IMAGES_PATH') ?: base_path('../public/images'),
    ],
    // Uploaded and bundled images are read locally. Allow additional image hosts explicitly.
    'remote_image_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env('PRODUCT_PDF_REMOTE_IMAGE_HOSTS', ''))))),
];
