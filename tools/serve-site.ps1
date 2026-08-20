$root = "C:\Users\joe_n\CLAUDE\Projects\CMS"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8940/")
$listener.Start()
Write-Output "serving $root on http://localhost:8940/"
$mime = @{ ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".js"="application/javascript; charset=utf-8";
           ".webp"="image/webp"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png"; ".json"="application/json" }
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $p = [System.Uri]::UnescapeDataString($ctx.Request.Url.LocalPath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($p)) { $p = "index.html" }
    $file = Join-Path $root ($p -replace '/','\')
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentType = $ct
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
    $ctx.Response.Close()
  } catch { }
}
