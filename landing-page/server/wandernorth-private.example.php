<?php

// Rename this file to wandernorth-private.php, replace every placeholder,
// and upload it one directory above public_html. Never commit the real file.
return [
    'db_host' => 'localhost',
    'db_name' => 'u123456789_wandernorth',
    'db_user' => 'u123456789_waitlist',
    'db_password' => 'REPLACE_WITH_THE_HOSTINGER_DATABASE_PASSWORD',
    'allowed_origins' => [
        'https://wandernorth.example',
        'https://www.wandernorth.example',
    ],
    // Generate a long random value. This is used only to create anonymous,
    // short-lived rate-limit keys; raw visitor IP addresses are not stored.
    'rate_limit_secret' => 'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS',
    'rate_limit_max' => 5,
    'rate_limit_window_seconds' => 600,
    'consent_text_version' => 'waitlist-v1',
];
