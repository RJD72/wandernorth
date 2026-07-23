<?php

declare(strict_types=1);

ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function requiredText(array $payload, string $key, int $maxLength): string
{
    $value = isset($payload[$key]) && is_string($payload[$key])
        ? trim($payload[$key])
        : '';

    if ($value === '' || textLength($value) > $maxLength) {
        throw new InvalidArgumentException("Invalid {$key}.");
    }

    return $value;
}

function optionalText(array $payload, string $key, int $maxLength): ?string
{
    if (!isset($payload[$key]) || $payload[$key] === '') {
        return null;
    }

    if (!is_string($payload[$key])) {
        throw new InvalidArgumentException("Invalid {$key}.");
    }

    $value = trim($payload[$key]);
    if (textLength($value) > $maxLength) {
        throw new InvalidArgumentException("Invalid {$key}.");
    }

    return $value === '' ? null : $value;
}

function referralValue(array $payload, string $key): ?string
{
    $referral = $payload['referralSource'] ?? [];
    if (!is_array($referral)) {
        throw new InvalidArgumentException('Invalid referralSource.');
    }

    return optionalText($referral, $key, 150);
}

function enforceOrigin(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }

    $allowedOrigins = $config['allowed_origins'] ?? [];
    if (!is_array($allowedOrigins) || !in_array($origin, $allowedOrigins, true)) {
        respond(403, ['ok' => false, 'message' => 'Request origin is not allowed.']);
    }
}

function enforceRateLimit(array $config): void
{
    $secret = (string) ($config['rate_limit_secret'] ?? '');
    if (strlen($secret) < 32) {
        throw new RuntimeException('The rate-limit secret is not configured.');
    }

    $maximum = max(1, (int) ($config['rate_limit_max'] ?? 5));
    $windowSeconds = max(60, (int) ($config['rate_limit_window_seconds'] ?? 600));
    $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = hash_hmac('sha256', $remoteAddress, $secret);
    $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . "wn-waitlist-{$key}.json";
    $handle = fopen($path, 'c+');

    if ($handle === false || !flock($handle, LOCK_EX)) {
        throw new RuntimeException('The rate limiter is unavailable.');
    }

    try {
        $contents = stream_get_contents($handle);
        $state = is_string($contents) && $contents !== ''
            ? json_decode($contents, true)
            : null;
        $now = time();

        if (
            !is_array($state)
            || !isset($state['startedAt'], $state['count'])
            || ($now - (int) $state['startedAt']) >= $windowSeconds
        ) {
            $state = ['startedAt' => $now, 'count' => 0];
        }

        if ((int) $state['count'] >= $maximum) {
            respond(429, [
                'ok' => false,
                'message' => 'Too many signup attempts. Please wait a few minutes and try again.',
            ]);
        }

        $state['count'] = (int) $state['count'] + 1;
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($state));
        fflush($handle);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
}

$documentRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), DIRECTORY_SEPARATOR);
$defaultConfigPath = dirname($documentRoot) . DIRECTORY_SEPARATOR . 'wandernorth-private.php';
$configPath = getenv('WANDER_NORTH_CONFIG_PATH') ?: $defaultConfigPath;

if (!is_file($configPath)) {
    error_log('[Wander North waitlist] Private configuration file was not found.');
    respond(500, ['ok' => false, 'message' => 'The signup service is not configured yet.']);
}

$config = require $configPath;
if (!is_array($config)) {
    error_log('[Wander North waitlist] Private configuration did not return an array.');
    respond(500, ['ok' => false, 'message' => 'The signup service is not configured correctly.']);
}

try {
    enforceOrigin($config);

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 20_000) {
        respond(413, ['ok' => false, 'message' => 'The submission is too large.']);
    }

    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || $rawBody === '') {
        throw new InvalidArgumentException('The request body is empty.');
    }
    if (strlen($rawBody) > 20_000) {
        respond(413, ['ok' => false, 'message' => 'The submission is too large.']);
    }

    $payload = json_decode($rawBody, true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new InvalidArgumentException('The request body must be a JSON object.');
    }

    $website = optionalText($payload, 'website', 200);
    if ($website !== null) {
        respond(200, ['ok' => true]);
    }

    enforceRateLimit($config);

    $firstName = requiredText($payload, 'firstName', 80);
    $email = strtolower(requiredText($payload, 'email', 254));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Invalid email.');
    }

    $region = requiredText($payload, 'region', 100);
    $travelStyle = requiredText($payload, 'travelStyle', 100);
    $desiredOutcome = requiredText($payload, 'desiredOutcome', 1_500);
    $valueReason = optionalText($payload, 'valueReason', 180);
    $pricingPreference = optionalText($payload, 'pricingPreference', 180);

    if (
        isset($payload['wantsEarlyTesting'])
        && !is_bool($payload['wantsEarlyTesting'])
    ) {
        throw new InvalidArgumentException('Invalid wantsEarlyTesting.');
    }
    $wantsEarlyTesting = ($payload['wantsEarlyTesting'] ?? false) ? 1 : 0;

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        (string) ($config['db_host'] ?? 'localhost'),
        requiredText($config, 'db_name', 100),
    );
    $pdo = new PDO(
        $dsn,
        requiredText($config, 'db_user', 100),
        requiredText($config, 'db_password', 255),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ],
    );

    $statement = $pdo->prepare(
        'INSERT INTO waitlist_submissions (
            first_name,
            email,
            region,
            travel_style,
            desired_outcome,
            value_reason,
            pricing_preference,
            wants_early_testing,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            consent_text_version,
            consent_received_at
        ) VALUES (
            :first_name,
            :email,
            :region,
            :travel_style,
            :desired_outcome,
            :value_reason,
            :pricing_preference,
            :wants_early_testing,
            :utm_source,
            :utm_medium,
            :utm_campaign,
            :utm_content,
            :consent_text_version,
            UTC_TIMESTAMP()
        )
        ON DUPLICATE KEY UPDATE
            first_name = VALUES(first_name),
            region = VALUES(region),
            travel_style = VALUES(travel_style),
            desired_outcome = VALUES(desired_outcome),
            value_reason = VALUES(value_reason),
            pricing_preference = VALUES(pricing_preference),
            wants_early_testing = VALUES(wants_early_testing),
            utm_source = VALUES(utm_source),
            utm_medium = VALUES(utm_medium),
            utm_campaign = VALUES(utm_campaign),
            utm_content = VALUES(utm_content),
            consent_text_version = VALUES(consent_text_version),
            consent_received_at = UTC_TIMESTAMP(),
            submission_count = submission_count + 1,
            updated_at = UTC_TIMESTAMP()',
    );

    $statement->execute([
        ':first_name' => $firstName,
        ':email' => $email,
        ':region' => $region,
        ':travel_style' => $travelStyle,
        ':desired_outcome' => $desiredOutcome,
        ':value_reason' => $valueReason,
        ':pricing_preference' => $pricingPreference,
        ':wants_early_testing' => $wantsEarlyTesting,
        ':utm_source' => referralValue($payload, 'utm_source'),
        ':utm_medium' => referralValue($payload, 'utm_medium'),
        ':utm_campaign' => referralValue($payload, 'utm_campaign'),
        ':utm_content' => referralValue($payload, 'utm_content'),
        ':consent_text_version' => (string) ($config['consent_text_version'] ?? 'waitlist-v1'),
    ]);

    respond(200, ['ok' => true]);
} catch (JsonException | InvalidArgumentException $error) {
    respond(422, ['ok' => false, 'message' => 'Please check the submitted details and try again.']);
} catch (Throwable $error) {
    error_log('[Wander North waitlist] ' . $error->getMessage());
    respond(500, ['ok' => false, 'message' => 'We could not save the signup right now.']);
}
