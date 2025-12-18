# iOS App Store Upload Guide

## Prerequisites

1. **Apple Developer Account**
   - Sign up at https://developer.apple.com
   - Pay the annual $99 fee
   - Complete your developer account setup
   - Enroll in the Apple Developer Program

2. **EAS Build Account**
   - Make sure you're logged in: `eas login`
   - If you don't have an account, sign up at https://expo.dev

3. **App Store Connect Setup**
   - Go to https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account
   - Create a new app (if you haven't already)

## Step 1: Configure Your App in App Store Connect

1. **Create New App**
   - Go to App Store Connect
   - Click "My Apps" → "+" → "New App"
   - Fill in:
     - **Platform**: iOS
     - **Name**: Catch
     - **Primary Language**: English (or your preferred language)
     - **Bundle ID**: `com.crazydev0409.catchapp` (must match app.json)
     - **SKU**: A unique identifier (e.g., `catch-ios-001`)
     - **User Access**: Full Access

2. **App Information**
   - Fill in required information:
     - **Category**: Select appropriate categories (e.g., Productivity, Social Networking)
     - **Privacy Policy URL**: Required (you need to create one)
     - **Support URL**: Your support website or email

## Step 2: Build Your iOS App

### Build for Production

```bash
cd moment-frontend
eas build --platform ios --profile production
```

This will:
- Build an iOS app bundle (.ipa file)
- Sign it with your Apple Developer certificate
- Upload it to EAS servers

### First Time Setup

If this is your first iOS build, EAS will guide you through:
1. **Apple Developer Account**: You'll need to provide your Apple ID
2. **Credentials**: EAS can automatically manage certificates and provisioning profiles
3. **Distribution Certificate**: EAS will create one for you
4. **Provisioning Profile**: EAS will generate the appropriate profile

## Step 3: Download Your Build

After the build completes:
1. Go to https://expo.dev/accounts/[your-account]/builds
2. Download your `.ipa` file
3. Or use EAS Submit to upload directly (see Step 5)

## Step 4: Complete App Store Listing

In App Store Connect, fill in:

1. **App Information**
   - **Name**: Catch
   - **Subtitle**: Brief tagline (30 characters max)
   - **Category**: Primary and secondary categories
   - **Privacy Policy URL**: Required

2. **Pricing and Availability**
   - Set price (Free or Paid)
   - Select countries where app will be available
   - Set availability date

3. **App Privacy**
   - Complete the privacy questionnaire
   - Declare what data you collect:
     - Location data (for weather)
     - Contacts (for contact management)
     - Device information (for push notifications)

4. **App Store Preview**
   - **Screenshots**: Required
     - iPhone 6.7" Display (iPhone 14 Pro Max, etc.): 1290 x 2796 pixels
     - iPhone 6.5" Display (iPhone 11 Pro Max, etc.): 1242 x 2688 pixels
     - iPhone 5.5" Display (iPhone 8 Plus, etc.): 1242 x 2208 pixels
     - At least 3 screenshots required
   - **App Preview Video** (optional): 15-30 seconds
   - **Description**: Up to 4000 characters
   - **Keywords**: Up to 100 characters (comma-separated)
   - **Support URL**: Required
   - **Marketing URL** (optional)
   - **Promotional Text** (optional): 170 characters

5. **Version Information**
   - **What's New in This Version**: Release notes
   - **Copyright**: Your copyright information
   - **Trade Representative Contact Information**: Required for some regions

## Step 5: Upload Your Build

### Option A: Using EAS Submit (Recommended)

```bash
cd moment-frontend
eas submit --platform ios --profile production
```

This will:
- Automatically upload your latest build to App Store Connect
- Handle authentication with Apple
- Submit for review

### Option B: Manual Upload via App Store Connect

1. Go to App Store Connect
2. Select your app
3. Go to "TestFlight" tab (for beta testing) or "App Store" tab
4. Click "+" to add a new version
5. Upload your `.ipa` file using:
   - **Transporter app** (download from Mac App Store)
   - **Xcode** (Organizer → Archives → Distribute App)
   - **Command line tools** (`xcrun altool` or `xcrun notarytool`)

## Step 6: TestFlight (Optional but Recommended)

Before submitting to the App Store:

1. **Upload to TestFlight**
   - Go to TestFlight tab in App Store Connect
   - Add your build
   - Add internal testers (up to 100)
   - Add external testers (up to 10,000) - requires Beta App Review

2. **Test Your App**
   - Install TestFlight app on your device
   - Test all features thoroughly
   - Fix any issues before App Store submission

## Step 7: Submit for App Store Review

1. **Complete All Required Information**
   - Ensure all sections are complete:
     - ✅ App Information
     - ✅ Pricing and Availability
     - ✅ App Privacy
     - ✅ App Store Preview (screenshots, description)
     - ✅ Version Information
     - ✅ Build uploaded

2. **Submit for Review**
   - In App Store Connect, go to your app version
   - Click "Submit for Review"
   - Answer any export compliance questions
   - Submit

3. **Review Process**
   - Apple typically reviews within 24-48 hours
   - You'll receive email notifications about status changes
   - If rejected, address the issues and resubmit

## Important Notes

### Bundle Identifier
- Currently set to: `com.crazydev0409.catchapp`
- Must match exactly in App Store Connect
- Cannot be changed after first submission

### Version Numbers
- **Version** (CFBundleShortVersionString): `1.0.0` in app.json
- **Build Number** (CFBundleVersion): `1` in app.json
- Increment build number for each new build
- Increment version for each App Store release

### App Signing
- EAS Build automatically manages certificates and provisioning profiles
- For production builds, EAS uses your Apple Developer account
- First build may require additional setup

### Privacy Requirements
Your app uses:
- **Location Services**: For weather updates
- **Contacts**: For contact management and meeting scheduling
- **Push Notifications**: For meeting requests and updates

Make sure your Privacy Policy covers all of these.

### Required Assets
- **App Icon**: 1024 x 1024 pixels (PNG, no transparency)
- **Screenshots**: Multiple sizes required (see Step 4)
- **Privacy Policy URL**: Must be publicly accessible

## Troubleshooting

### Build Issues
- **Certificate Errors**: EAS will help regenerate if needed
- **Provisioning Profile Issues**: EAS manages these automatically
- **Missing Permissions**: Check app.json infoPlist section

### Upload Issues
- **Invalid Bundle**: Check bundle identifier matches
- **Missing Entitlements**: EAS handles this automatically
- **Code Signing Errors**: Contact EAS support or check Apple Developer account

### Review Rejection
- Read Apple's feedback carefully
- Address all issues mentioned
- Update app if needed and resubmit
- Common issues:
  - Missing privacy policy
  - Incomplete app information
  - App crashes or bugs
  - Missing required permissions descriptions

## Quick Commands Reference

```bash
# Login to EAS
eas login

# Build for iOS production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production

# Check build status
eas build:list

# View build logs
eas build:view [build-id]
```

## Next Steps After Approval

1. Monitor reviews and ratings
2. Respond to user feedback
3. Plan updates and new features
4. Track analytics in App Store Connect
5. Update app regularly to maintain visibility

Good luck with your App Store submission! 🚀

