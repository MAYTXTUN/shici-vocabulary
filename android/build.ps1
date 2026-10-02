param([int]$VersionCode = 1, [string]$VersionName = '1.0.0')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$toolsRoot = Join-Path $projectRoot '.android-tools'
$jdkRoot = (Get-ChildItem (Join-Path $toolsRoot 'jdk') -Directory | Select-Object -First 1).FullName
$java = Join-Path $jdkRoot 'bin\java.exe'
$javac = Join-Path $jdkRoot 'bin\javac.exe'
$jar = Join-Path $jdkRoot 'bin\jar.exe'
$keytool = Join-Path $jdkRoot 'bin\keytool.exe'
$buildTools = Join-Path $toolsRoot 'build-tools\android-15'
$androidJar = Join-Path $toolsRoot 'platform\android-35\android.jar'
$buildRoot = Join-Path $PSScriptRoot 'build'
$assets = Join-Path $buildRoot 'assets'
$resources = Join-Path $buildRoot 'res'
$classes = Join-Path $buildRoot 'classes'
$dex = Join-Path $buildRoot 'dex'
$signing = Join-Path $PSScriptRoot 'signing'
$keystore = Join-Path $signing 'shici-release.jks'
$passwordFile = Join-Path $signing 'password.txt'
$output = Join-Path $projectRoot '拾词-安卓安装包.apk'

function Run-Tool([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw ('构建失败：' + $Exe) }
}
foreach ($required in @($java, $javac, $androidJar, (Join-Path $buildTools 'aapt2.exe'))) {
    if (!(Test-Path -LiteralPath $required)) { throw ('缺少构建工具：' + $required) }
}
New-Item -ItemType Directory -Force -Path $assets,$resources,$classes,$dex,$signing,(Join-Path $resources 'drawable') | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'res\values') -Destination $resources -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'icon-192.png') -Destination (Join-Path $resources 'drawable\icon.png') -Force
foreach ($name in @('index.html','styles.css','core.js','learning-aids.js','app.js','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $assets $name) -Force
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'native-adapter.js') -Destination $assets -Force
$indexPath = Join-Path $assets 'index.html'
$html = [IO.File]::ReadAllText($indexPath, [Text.Encoding]::UTF8)
$html = $html.Replace('<script src="./app.js"></script>', '<script src="./native-adapter.js"></script><script src="./app.js"></script>')
[IO.File]::WriteAllText($indexPath, $html, [Text.UTF8Encoding]::new($false))

Run-Tool $javac @('--release','8','-encoding','UTF-8','-classpath',$androidJar,'-d',$classes,(Join-Path $PSScriptRoot 'src\com\shici\vocabulary\MainActivity.java'))
$codeJar = Join-Path $buildRoot 'code.jar'
Run-Tool $jar @('--create','--file',$codeJar,'-C',$classes,'.')
Run-Tool $java @('-cp',(Join-Path $buildTools 'lib\d8.jar'),'com.android.tools.r8.D8','--min-api','26','--lib',$androidJar,'--output',$dex,$codeJar)
$resourceZip = Join-Path $buildRoot 'resources.zip'
Push-Location $buildRoot
try {
Run-Tool (Join-Path $buildTools 'aapt2.exe') @('compile','--dir','res','-o','resources.zip')
$unsigned = Join-Path $buildRoot 'unsigned.apk'
Run-Tool (Join-Path $buildTools 'aapt2.exe') @('link','--auto-add-overlay','-I','../../.android-tools/platform/android-35/android.jar','--manifest','../AndroidManifest.xml','-R','resources.zip','-A','assets','--min-sdk-version','26','--target-sdk-version','35','--version-code',[string]$VersionCode,'--version-name',$VersionName,'-o','unsigned.apk')
Run-Tool $jar @('--update','--file',$unsigned,'-C',$dex,'classes.dex')
$aligned = Join-Path $buildRoot 'aligned.apk'
Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-p','-f','4','unsigned.apk','aligned.apk')
if (!(Test-Path -LiteralPath $keystore)) {
    $randomBytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($randomBytes)
    $random.Dispose()
    $password = [Convert]::ToBase64String($randomBytes)
    [IO.File]::WriteAllText($passwordFile, $password, [Text.UTF8Encoding]::new($false))
    Run-Tool $keytool @('-genkeypair','-keystore',$keystore,'-storepass:file',$passwordFile,'-keypass:file',$passwordFile,'-alias','shici','-keyalg','RSA','-keysize','2048','-validity','36500','-dname','CN=Shici Local App','-noprompt')
}
if (!(Test-Path -LiteralPath $passwordFile)) { throw '签名密码文件丢失，无法生成兼容的升级安装包。' }
Run-Tool $java @('-jar',(Join-Path $buildTools 'lib\apksigner.jar'),'sign','--ks',$keystore,'--ks-key-alias','shici','--ks-pass',('file:' + $passwordFile),'--out','signed.apk','aligned.apk')
Run-Tool $java @('-jar',(Join-Path $buildTools 'lib\apksigner.jar'),'verify','--verbose','signed.apk')
Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-c','4','signed.apk')
Copy-Item -LiteralPath 'signed.apk' -Destination $output -Force
} finally { Pop-Location }
Get-Item -LiteralPath $output | Select-Object Name,Length,LastWriteTime
