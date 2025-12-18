# Google Play Store Upload Guide

## Prerequisites

1. **Google Play Console Account**
   - Sign up at https://play.google.com/console
   - Pay the one-time $25 registration fee
   - Complete your developer account setup

2. **EAS Build Account**
   - Make sure you're logged in: `eas login`
   - If you don't have an account, sign up at https://expo.dev

## Step 1: Build Your App

### Option A: Build AAB (Recommended for Google Play)
```bash
cd moment-frontend
eas build --platform android --profile production
```

### Option B: Build APK (If you already have an APK)
If you already built an APK and want to use it, you can upload it directly, but AAB is preferred.

## Step 2: Download Your Build

After the build completes:
1. Go to https://expo.dev/accounts/[your-account]/builds
2. Download your `.aab` or `.apk` file

## Step 3: Create App in Google Play Console

1. **Create New App**
   - Go to Google Play Console
   - Click "Create app"
   - Fill in:
     - **App name**: Catch
     - **Default language**: English (or your preferred language)
     - **App or game**: App
     - **Free or paid**: Choose based on your preference
     - **Declarations**: Accept terms

2. **App Access**
   - Choose if your app is available to all users or restricted

## Step 4: Complete Store Listing

Fill in required information:
- **App name**: Catch
- **Short description**: Brief description (80 characters max)
- **Full description**: Detailed description (4000 characters max)
- **App icon**: Upload 512x512 PNG icon
- **Feature graphic**: 1024x500 PNG image
- **Screenshots**: At least 2 screenshots (phone, tablet if applicable)
- **Privacy Policy**: Required URL (you need to create one)

## Step 5: Set Up App Content

1. **Content Rating**
   - Complete the questionnaire
   - Get your content rating

2. **Target Audience**
   - Set age groups

3. **Data Safety**
   - Declare what data your app collects
   - For your app, you likely collect:
     - Location data (for weather/meeting locations)
     - Contacts (for contact management)
     - Device information (for push notifications)

## Step 6: Upload Your App Bundle/APK

1. **Go to Production (or Testing)**
   - In Google Play Console, go to "Production" (or "Internal testing" for testing)
   - Click "Create new release"

2. **Upload Your Build**
   - Drag and drop your `.aab` file (or `.apk`)
   - Or click "Upload" and select your file

3. **Release Name**
   - Enter version name (e.g., "1.0.0")
   - Add release notes

4. **Review and Rollout**
   - Review all information
   - Click "Save" then "Review release"
   - After review, click "Start rollout to Production"

## Step 7: Complete Required Forms

1. **App Content**
   - Complete all required sections
   - Privacy Policy URL is mandatory

2. **Pricing & Distribution**
   - Set price (Free or Paid)
   - Select countries where app will be available
   - Accept export compliance

## Step 8: Submit for Review

1. **Review Checklist**
   - Ensure all required sections are complete:
     - ✅ Store listing
     - ✅ App content
     - ✅ Graphics
     - ✅ Privacy policy
     - ✅ Content rating
     - ✅ Data safety

2. **Submit**
   - Click "Submit for review"
   - Google will review your app (usually 1-7 days)

## Important Notes

### App Signing
- EAS Build automatically signs your app with a managed keystore
- Google Play will re-sign your app with their own key for security
- This is handled automatically

### Version Code
- Each release must have a higher `versionCode` than the previous
- Currently set to `1` in `app.json`
- Increment this for each new release

### Privacy Policy
You need to create a privacy policy that covers:
- What data you collect
- How you use it
- Third-party services (e.g., Expo, Twilio for notifications)
- User rights

### Testing
Before going to production, consider:
1. **Internal testing**: Test with your team
2. **Closed testing**: Test with a small group
3. **Open testing**: Public beta testing
4. **Production**: Full release

## Troubleshooting

### Build Issues
- Make sure you're logged into EAS: `eas login`
- Check your `app.json` configuration
- Verify all required assets exist

### Upload Issues
- Ensure file is `.aab` or `.apk` format
- Check file size (max 150MB for APK, 150MB for AAB)
- Verify app is properly signed

### Review Rejection
- Read Google's feedback carefully
- Address all issues mentioned
- Resubmit after fixes

## Quick Commands Reference

```bash
# Login to EAS
eas login

# Build for production (AAB)
eas build --platform android --profile production

# Build APK (if needed)
eas build --platform android --profile preview

# Check build status
eas build:list

# Submit directly to Google Play (if configured)
eas submit --platform android
```

## Next Steps After Approval

1. Monitor reviews and ratings
2. Respond to user feedback
3. Plan updates and new features
4. Track analytics in Google Play Console

Good luck with your release! 🚀

