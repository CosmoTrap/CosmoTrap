<?php
// Mise à jour du site depuis la branche « hostinger » du dépôt GitHub (site compilé par le workflow
// « Mise en ligne » ou par `npm run deploy`), puis remplacement des fichiers de public_html.
//
// Deux façons de le lancer :
//  - tâche Cron Hostinger (toutes les 5 min) : `php …/public_html/api/deploy.php` → ne fait rien si la
//    version en ligne est déjà la dernière ;
//  - HTTP POST avec l'en-tête X-Deploy-Token (jeton rangé hors du dossier web, dans
//    ../../cosmotrap-data/deploy-token.txt) → mise à jour immédiate.
declare(strict_types=1);

const REPO = 'CosmoTrap/CosmoTrap';
const BRANCH = 'hostinger';
$cli = PHP_SAPI === 'cli';
$data = dirname(__DIR__, 2) . '/cosmotrap-data';
$web = dirname(__DIR__);

function done(array $r, int $code = 200): void {
  global $cli;
  if ($cli) {
    // Cron : silencieux quand il n'y a rien à faire (pas d'e-mail de Hostinger toutes les 5 min)
    if (empty($r['upToDate'])) echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n";
    exit($code === 200 ? 0 : 1);
  }
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($r, JSON_UNESCAPED_UNICODE);
  exit;
}

if (!$cli) {
  $tokenFile = $data . '/deploy-token.txt';
  $expected = is_file($tokenFile) ? trim((string)file_get_contents($tokenFile)) : '';
  $given = (string)($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '');
  if ($_SERVER['REQUEST_METHOD'] !== 'POST' || strlen($expected) < 32 || !hash_equals($expected, $given)) done(['error' => 'Accès refusé.'], 403);
}

@set_time_limit(600);
@ini_set('memory_limit', '512M');
if (!is_dir($data)) mkdir($data, 0700, true);

// une seule mise à jour à la fois (Cron et appel manuel simultanés)
$lock = fopen($data . '/deploy.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) done(['ok' => true, 'upToDate' => true, 'busy' => true]);

function get(string $url, ?string $file = null): array {
  $ch = curl_init($url);
  $fh = $file ? fopen($file, 'wb') : null;
  curl_setopt_array($ch, [CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 500, CURLOPT_CONNECTTIMEOUT => 20, CURLOPT_USERAGENT => 'cosmotrap-deploy']);
  if ($fh) curl_setopt($ch, CURLOPT_FILE, $fh);
  else curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($fh) fclose($fh);
  return [$body !== false && $code === 200, $body];
}

// dernière version de la branche (protocole git, sans la limite de l'API GitHub)
[$ok, $refs] = get('https://github.com/' . REPO . '.git/info/refs?service=git-upload-pack');
if (!$ok || !preg_match('/([0-9a-f]{40}) refs\/heads\/' . BRANCH . '\b/', (string)$refs, $m)) done(['error' => 'Branche ' . BRANCH . ' introuvable sur GitHub.'], 502);
$sha = $m[1];
$shaFile = $data . '/deployed-sha.txt';
$current = is_file($shaFile) ? trim((string)file_get_contents($shaFile)) : '';
if ($sha === $current) done(['ok' => true, 'upToDate' => true, 'version' => substr($sha, 0, 7)]);

$tmp = sys_get_temp_dir() . '/cosmotrap-' . bin2hex(random_bytes(4));
mkdir($tmp, 0700, true);
$zip = $tmp . '/site.zip';
for ($try = 1; $try <= 3; $try++) {
  [$ok] = get('https://codeload.github.com/' . REPO . '/zip/' . $sha, $zip);
  if ($ok && filesize($zip) > 1000000) break;
  if ($try === 3) done(['error' => 'Téléchargement de la version ' . substr($sha, 0, 7) . ' impossible.'], 502);
  sleep(3);
}

$z = new ZipArchive();
if ($z->open($zip) !== true) done(['error' => 'Archive illisible.'], 500);
$z->extractTo($tmp . '/x');
$z->close();
$root = glob($tmp . '/x/*', GLOB_ONLYDIR)[0] ?? null;
if (!$root || !is_file($root . '/index.html')) done(['error' => 'Archive incomplète.'], 500);

$n = 0;
$failed = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
foreach ($it as $f) {
  $rel = substr($f->getPathname(), strlen($root) + 1);
  if ($rel === 'api/config.local.php') continue;
  $dst = $web . '/' . $rel;
  if ($f->isDir()) {
    if (!is_dir($dst)) mkdir($dst, 0755, true);
    continue;
  }
  // index.html en dernier : les nouveaux fichiers JS/CSS sont en place avant qu'on les référence
  if ($rel === 'index.html') continue;
  copy($f->getPathname(), $dst) ? $n++ : $failed[] = $rel;
}
copy($root . '/index.html', $web . '/index.html') ? $n++ : $failed[] = 'index.html';

$rm = function (string $d) use (&$rm): void {
  foreach (array_diff(scandir($d), ['.', '..']) as $e) {
    $p = "$d/$e";
    is_dir($p) ? $rm($p) : unlink($p);
  }
  rmdir($d);
};
$rm($tmp);
if (!$failed) file_put_contents($shaFile, $sha);
done(['ok' => !$failed, 'version' => substr($sha, 0, 7), 'files' => $n, 'failed' => $failed]);
