$content = [IO.File]::ReadAllText("E:\block-ide\app\src\main.ts")
$open = 0
for($i=0; $i -lt $content.Length; $i++) {
    $c = $content[$i]
    if($c -eq '{') {
        $open++
        if($open -gt 688) {
            $line = ($content.Substring(0,$i) -split "`n").Count
            Write-Output ("Line $line: " + $content.Substring($i,20))
        }
    } elseif($c -eq '}') {
        $open--
    }
}
Write-Output ("Final: " + $open)