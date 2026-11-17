<?php

declare(strict_types=1);

/*
 * Router script for `php -S 127.0.0.1:8765 tests/E2eCsp/public/index.php` (strict-CSP browser test only).
 * Serves the built bundle assets under /bundles/nowoiconselector/ (as assets:install would) and boots CspKernel
 * with the environment named by the first path segment (/bundle/... or /local/...).
 */

use Nowo\IconSelectorBundle\Tests\E2eCsp\CspKernel;
use Symfony\Component\HttpFoundation\Request;

$root = dirname(__DIR__, 3);
$path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), \PHP_URL_PATH);

if (str_starts_with($path, '/bundles/nowoiconselector/')) {
    $publicDir = (string) realpath($root . '/src/Resources/public');
    $file      = realpath($publicDir . '/' . substr($path, strlen('/bundles/nowoiconselector/')));
    if ($file === false || !str_starts_with($file, $publicDir . '/') || !is_file($file)) {
        http_response_code(404);

        return true;
    }
    $types = ['js' => 'text/javascript', 'css' => 'text/css', 'json' => 'application/json'];
    header('Content-Type: ' . ($types[pathinfo($file, \PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
    readfile($file);

    return true;
}

require $root . '/vendor/autoload.php';

$environment = explode('/', trim($path, '/'))[0];
if (!in_array($environment, CspKernel::ENVIRONMENTS, true)) {
    http_response_code(404);
    echo 'Use /bundle/form or /local/form';

    return true;
}

$kernel   = new CspKernel($environment, true);
$request  = Request::createFromGlobals();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);

return true;
