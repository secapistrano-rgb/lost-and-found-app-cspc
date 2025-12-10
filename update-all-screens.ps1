# PowerShell script to batch update all screens with internet guards

$screens = @(
    "src/features/items/screens/UserItemHistory.js",
    "src/features/matching/screens/MatchesScreen.js",
    "src/features/matching/screens/MatchDetailsScreen.js",
    "src/features/matching/screens/ClaimRequestsScreen.js",
    "src/features/matching/screens/ClaimDetailsScreen.js",
    "src/features/profile/screens/UserProfileScreen.js",
    "src/features/profile/screens/UserStatsScreen.js",
    "src/features/profile/screens/UserAchievementsScreen.js",
    "src/features/profile/screens/UserFeedbackScreen.js",
    "src/features/profile/screens/SettingsScreen.js",
    "src/features/profile/screens/HelpSupportScreen.js",
    "src/features/profile/screens/ClearStorageScreen.js",
    "src/features/auth/screens/HelpSignInScreen.js",
    "src/features/auth/screens/TwoFactorVerificationScreen.js",
    "src/features/notifications/screens/NotificationsScreen.js"
)

$importLine = "import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';"

foreach ($screen in $screens) {
    $fullPath = "C:\Users\CAPISTRANO\Pictures\lost-and-found\$screen"
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        
        # Extract screen name from path
        $screenName = [System.IO.Path]::GetFileNameWithoutExtension($screen)
        
        # Check if already has import
        if ($content -notmatch "withInternetGuard") {
            # Add import after last import statement
            $content = $content -replace "(import .+ from .+;)(\r?\n\r?\n)", "`$1`r`n$importLine`r`n"
            
            # Update export
            $content = $content -replace "export default $screenName;", "export default withInternetGuard($screenName);"
            
            # Save file
            Set-Content -Path $fullPath -Value $content -NoNewline
            Write-Host "Updated: $screen" -ForegroundColor Green
        } else {
            Write-Host "Skipped (already updated): $screen" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Not found: $screen" -ForegroundColor Red
    }
}

Write-Host "`nAll screens have been updated!" -ForegroundColor Cyan
