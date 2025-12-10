import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
  Platform,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getItemById, createClaim, getClaimsByMatch } from '../../../config/apiConfig';
// Notification import removed - now handled by database triggers (see create_claim_notification_triggers.sql)
import { checkAndUpdateAchievements } from '../../../shared/utils/achievementSystem';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { requireInternet } from '../../../shared/utils/internetRequired';

import ImagePickerComponent from '../components/ImagePickerComponent';

const ClaimItemScreen = ({ navigation, route }) => {
  const { matchId, itemTitle, foundItem, lostItem } = route.params || {};
  const [proofOfOwnershipText, setProofOfOwnershipText] = useState('');
  const [proofOfOwnershipImage, setProofOfOwnershipImage] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [itemStatus, setItemStatus] = useState('pending');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasExistingClaim, setHasExistingClaim] = useState(false);
  const [hasMultipleClaims, setHasMultipleClaims] = useState(false);
  const [claimCount, setClaimCount] = useState(0);
  
  const { alertConfig, showError, showSuccess, showConfirm, hideAlert } = useProfessionalAlert();
  


  

  // Handle camera capture
  const takePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageAsset = result.assets[0];
        
        // Validate image format first
        const formatValidation = validateImageFormat(imageAsset.uri);
        if (!formatValidation.isValid) {
          Alert.alert('Invalid Image', formatValidation.reason);
          return;
        }

        // Upload image and get URL first
        try {
          const imageUrl = await uploadImageAndGetUrl(imageAsset.uri);

          // Analyze image content for appropriateness using the remote URL
          const contentAnalysis = await analyzeImageForContent(imageUrl);
          if (!contentAnalysis.isAppropriate) {
            Alert.alert(
              'Inappropriate Content',
              `This image was flagged as inappropriate: ${contentAnalysis.reason}. Please select an image that shows objects or identification documents only.`
            );
            // Optionally, delete the uploaded image if it's inappropriate
            return;
          }

          const imageWithUrl = {
            ...imageAsset,
            imageUrl: imageUrl
          };
          
          setProofOfOwnershipImage(imageWithUrl);
        } catch (error) {
          console.error('Error processing image:', error);
          Alert.alert('Error', 'Failed to process the captured image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Show photo options
  const showPhotoOptions = () => {
    Alert.alert(
      'Add Photo',
      'Choose how you want to add a photo',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: selectPhoto },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // ImagePickerComponent handlers
  const handleImageSelected = (uri) => {
    setProofOfOwnershipImage({ uri, imageUrl: uri });
  };

  const handleCategoriesDetected = (detectedCategories) => {
    // Categories aren't needed for claim proof, but we need this handler
    console.log('Categories detected in claim proof:', detectedCategories);
  };

  const handleObjectsDetected = (detectedObjects) => {
    // Objects aren't needed for claim proof, but we need this handler
    console.log('Objects detected in claim proof:', detectedObjects);
  };

  const handleDescriptionGenerated = (description) => {
    // Auto-generated description isn't needed for claim proof, but we need this handler
    console.log('Description generated for claim proof:', description);
  };
  
  // Check for existing claims and multiple claims
  const checkExistingClaim = async (userEmail) => {
    try {
      // Check via API for more accurate data
      try {
        const existingClaims = await getClaimsByMatch(matchId);
        const hasExisting = existingClaims.some(
          claim => claim.claimant_id === userEmail || claim.google_user_id === userEmail
        );
        
        // Check for multiple claims (2 or more claims from different users)
        const uniqueClaimants = new Set(existingClaims.map(c => c.claimant_id || c.google_user_id));
        const totalClaims = uniqueClaimants.size;
        
        setHasExistingClaim(hasExisting);
        setHasMultipleClaims(totalClaims >= 2);
        setClaimCount(totalClaims);
        
        console.log(`Multiple claims check: ${totalClaims} unique claimants for match ${matchId}`);
        
        return hasExisting;
      } catch (apiError) {
        console.error('API check failed, falling back to AsyncStorage:', apiError);
        // Fallback to AsyncStorage
        const existingClaimsString = await AsyncStorage.getItem('claimRequests');
        const existingClaims = existingClaimsString ? JSON.parse(existingClaimsString) : [];
        
        const matchClaims = existingClaims.filter(claim => claim.matchId === matchId);
        const hasExisting = matchClaims.some(claim => claim.googleUserId === userEmail);
        
        const uniqueClaimants = new Set(matchClaims.map(c => c.googleUserId));
        const totalClaims = uniqueClaimants.size;
        
        setHasExistingClaim(hasExisting);
        setHasMultipleClaims(totalClaims >= 2);
        setClaimCount(totalClaims);
        
        return hasExisting;
      }
    } catch (error) {
      console.error('Error checking existing claims:', error);
      return false;
    }
  };

  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userDataString = await AsyncStorage.getItem('user_data');
        if (userDataString) {
          const parsedUserData = JSON.parse(userDataString);
          setUserData(parsedUserData);

          
          // Check for existing claims
          await checkExistingClaim(parsedUserData.email);
        } else {
          // If no user data, redirect to login
          showError(
            'Login Required',
            'You must be logged in with your @my.cspc.edu.ph account to claim items.',
            [{ 
              text: 'OK', 
              onPress: () => navigation.navigate('Login')
            }]
          );
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigation, matchId]);
  
  // SSC Office coordinates (13°24'23.2"N 123°22'31.4"E)
  // Convert from DMS to decimal degrees
  const latitude = 13 + (24/60) + (23.2/3600);  // 13.406444
  const longitude = 123 + (22/60) + (31.4/3600);  // 123.375389
  
  const openMapsApp = () => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${latitude},${longitude}`;
    const label = 'Supreme Student Council Office';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    
    Linking.openURL(url);
  };
  
  const handleSubmitClaimRequest = async () => {
    // Check internet connection first
    const hasInternet = await requireInternet('submit a claim request');
    if (!hasInternet) {
      return;
    }

    // Check if user is logged in with Google account
    if (!userData || !userData.email) {
      showError(
        'Login Required',
        'You must be logged in with your @my.cspc.edu.ph account to claim items.'
      );
      return;
    }
    
    if (!proofOfOwnershipText.trim()) {
      showError('Error', 'Please provide proof of ownership description');
      return;
    }
    
    // If multiple claims exist, show warning before proceeding
    if (hasMultipleClaims) {
      showConfirm(
        'Multiple Claims Detected',
        `${claimCount} ${claimCount > 2 ? 'users have' : 'other user has'} already claimed this item. Your proof must be highly specific and verifiable to be approved. Are you confident your proof is detailed enough?`,
        [
          {
            text: 'Review Proof',
            style: 'cancel',
            onPress: () => {
              // User can review and improve their proof
              return;
            }
          },
          {
            text: 'Submit Anyway',
            style: 'default',
            onPress: () => {
              // Continue with submission
              proceedWithSubmission();
            }
          }
        ]
      );
      return;
    }
    
    // If no multiple claims, proceed directly
    await proceedWithSubmission();
  };

  // Separated submission logic
  const proceedWithSubmission = async () => {
    try {
      setSubmitting(true);
      console.log('Starting claim submission process...');
      
      // Verify email domain is from CSPC
      if (!userData.email.toLowerCase().endsWith('@my.cspc.edu.ph')) {
        showError(
          'Unauthorized',
          'Only CSPC students and staff can submit claim requests.'
        );
        setSubmitting(false);
        return;
      }
      
      // Check if user has already submitted a claim for this match using API
      console.log('Checking for existing claims via API...');
      try {
        const existingClaims = await getClaimsByMatch(matchId);
        const hasExistingClaim = existingClaims.some(
          claim => claim.claimant_id === userData.email
        );
        
        if (hasExistingClaim) {
          console.log('Duplicate claim detected');
          showError(
            'Duplicate Claim',
            'You have already submitted a claim for this item.'
          );
          setSubmitting(false);
          return;
        }
      } catch (error) {
        console.error('Error checking existing claims:', error);
        // Continue with submission if check fails
      }
      
      // Determine item_id based on available items
      const itemId = lostItem?.id || foundItem?.id;
      if (!itemId) {
        showError(
          'Error',
          'No item ID found for this claim.'
        );
        setSubmitting(false);
        return;
      }
      
      // Prepare claim data for API
      const claimData = {
        claimant_id: userData.email,
        item_id: itemId,
        match_id: matchId,
        claim_type: 'ownership',
        status: 'pending',
        proof_of_ownership: hasMultipleClaims 
          ? `[COMPETING CLAIM - ${claimCount} total claimants] ${proofOfOwnershipText.trim()}`
          : proofOfOwnershipText.trim(),
        google_user_id: userData.email,
        // Include image URL if available
        image: proofOfOwnershipImage ? (proofOfOwnershipImage.imageUrl || proofOfOwnershipImage.uri) : null
      };
      
      console.log('Creating claim via API...');
      const response = await createClaim(claimData);
      console.log('Claim created successfully:', response.claimId);
      
      // Track achievement for claiming an item
      try {
        const itemType = lostItem ? 'lost' : 'found';
        const reporterEmail = lostItem ? lostItem.reporterId : foundItem?.reporterId;
        await checkAndUpdateAchievements(
          userData.email,
          'claim_item',
          { itemType, reporterEmail }
        );
      } catch (achievementError) {
        console.error('Error tracking claim achievement:', achievementError);
        // Continue even if achievement tracking fails
      }
      
      // Notification is now automatically handled by database trigger
      // See: create_claim_notification_triggers.sql - after_claim_status_update trigger
      console.log('Claim submitted - notification will be sent by database trigger');
      
      // Show success message
      console.log('Showing success message...');
      showSuccess(
        'Claim Request Submitted',
        'Your claim request with proof of ownership has been submitted successfully. You can view your requests in the Claims section.',
        [
          { 
            text: 'View Claims', 
            onPress: () => {
              // Navigate to ClaimRequests without resetting the stack
              navigation.navigate('ClaimRequests', { newClaimSubmitted: true });
            }
          },
          {
            text: 'Home',
            onPress: () => {
              // Navigate to home screen
              navigation.navigate('Main', { screen: 'Home' });
            },
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting claim request:', error);
      showError(
        'Error',
        'Failed to submit claim request: ' + (error.message || 'Unknown error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Requesting to Claim</Text>
        <View style={styles.placeholder} />
      </View>
      
      {loading ? (
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={{ marginTop: 16, color: '#666' }}>Loading...</Text>
        </View>
      ) : hasExistingClaim ? (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={[styles.infoCard, { backgroundColor: '#2ecc71' }]}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="checkmark-circle" size={28} color="#fff" style={styles.infoIcon} />
              </View>
              <Text style={styles.infoTitle}>Claim Already Submitted</Text>
              <Text style={styles.infoText}>
                You have already submitted a claim request for this item. You can check the status of your request in the Claims section.
              </Text>
            </View>
            
            <View style={styles.section}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="list-outline" size={20} color="#3498db" style={{marginRight: 8}} />
                <Text style={styles.sectionTitle}>What's Next?</Text>
              </View>
              <View style={styles.processList}>
                <View style={styles.processItem}>
                  <View style={styles.processNumberCircle}>
                    <Text style={styles.processNumber}>1</Text>
                  </View>
                  <Text style={styles.processText}>
                    Check your claim status in the Claims section
                  </Text>
                </View>
                <View style={styles.processItem}>
                  <View style={styles.processNumberCircle}>
                    <Text style={styles.processNumber}>2</Text>
                  </View>
                  <Text style={styles.processText}>
                    Wait for email confirmation from SSC staff
                  </Text>
                </View>
                <View style={styles.processItem}>
                  <View style={styles.processNumberCircle}>
                    <Text style={styles.processNumber}>3</Text>
                  </View>
                  <Text style={styles.processText}>
                    Visit the SSC office at your confirmed appointment time
                  </Text>
                </View>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => navigation.navigate('ClaimRequests')}
              activeOpacity={0.8}
            >
              <Ionicons name="list" size={20} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.submitButtonText}>View My Claims</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#95a5a6', marginTop: 10 }]}
              onPress={() => navigation.navigate('Main', { screen: 'Home' })}
              activeOpacity={0.8}
            >
              <Ionicons name="home" size={20} color="#fff" style={{marginRight: 8}} />
              <Text style={styles.submitButtonText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{flex: 1}}
        >
          <ScrollView 
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.content}>
          <View style={styles.infoCard}>
            <View style={styles.statusBadge}>
            </View>
            <View style={styles.infoIconContainer}>
              <Ionicons name="information-circle" size={28} color="#fff" style={styles.infoIcon} />
            </View>
            <Text style={styles.infoTitle}>Request to Claim This Item</Text>
            <Text style={styles.infoText}>
              To claim your {itemTitle || 'item'}, please provide proof of ownership. 
              Our Support Team will review your request and contact you via email.
            </Text>
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="document-text-outline" size={20} color="#3498db" style={{marginRight: 8}} />
              <Text style={styles.sectionTitle}>Proof of Ownership</Text>
            </View>
            
            {/* Consider Unique Features Section */}
            <View style={styles.uniqueFeaturesCard}>
              <View style={styles.uniqueFeaturesHeader}>
                <Ionicons name="bulb-outline" size={22} color="#f39c12" style={{marginRight: 8}} />
                <Text style={styles.uniqueFeaturesTitle}>Consider Unique Features or Characteristics</Text>
              </View>
              <Text style={styles.uniqueFeaturesSubtitle}>
                To help verify your ownership, describe unique details about your item. The more specific, the better!
              </Text>
              
              {/* Physical Characteristics */}
              <View style={styles.featureCategory}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="eye-outline" size={18} color="#3498db" />
                  <Text style={styles.categoryTitle}>Physical Characteristics</Text>
                </View>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Serial numbers, model numbers, or IMEI codes</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Scratches, dents, wear marks, or damage locations</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Unique colors, patterns, or color combinations</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Brand name, logo placement, or design details</Text>
                  </View>
                </View>
              </View>

              {/* Personalizations */}
              <View style={styles.featureCategory}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="brush-outline" size={18} color="#e74c3c" />
                  <Text style={styles.categoryTitle}>Personalizations & Modifications</Text>
                </View>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Custom stickers, decals, or artwork applied</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Engravings, name tags, or initials</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Custom accessories or attachments (keychains, charms)</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Repairs, patches, or DIY modifications</Text>
                  </View>
                </View>
              </View>

              {/* Contents & Documentation */}
              <View style={styles.featureCategory}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="document-outline" size={18} color="#9b59b6" />
                  <Text style={styles.categoryTitle}>Contents & Documentation</Text>
                </View>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Specific items inside (bags, wallets, cases)</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Purchase receipts, warranty cards, or proof of purchase</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Photos from when you first bought or used the item</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Packaging, original box, or accessories included</Text>
                  </View>
                </View>
              </View>

              {/* Digital & Technical */}
              <View style={styles.featureCategory}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#16a085" />
                  <Text style={styles.categoryTitle}>Digital & Technical Details</Text>
                </View>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Account login credentials or device settings</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Wallpapers, apps installed, or saved data</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Battery level, storage capacity, or technical specs</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                    <Text style={styles.featureText}>Recent photos, messages, or activity (if applicable)</Text>
                  </View>
                </View>
              </View>

              {/* Pro Tips */}
              <View style={styles.proTipsContainer}>
                <View style={styles.proTipsHeader}>
                  <Ionicons name="star" size={18} color="#f39c12" />
                  <Text style={styles.proTipsTitle}>Pro Tips for Better Verification</Text>
                </View>
                <View style={styles.tipsList}>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>1.</Text>
                    <Text style={styles.tipText}>Be as specific as possible - vague descriptions like "black wallet" are harder to verify than "black leather wallet with torn red stitching on bottom right"</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>2.</Text>
                    <Text style={styles.tipText}>Mention exact locations of damage or markings (e.g., "2-inch scratch on top-left corner near power button")</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>3.</Text>
                    <Text style={styles.tipText}>Include non-visible details only the owner would know (serial numbers, IMEI codes, contents in pockets, password-protected apps)</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>4.</Text>
                    <Text style={styles.tipText}>Upload clear, well-lit photos showing unique features from multiple angles - include close-ups of scratches, engravings, or custom modifications</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>5.</Text>
                    <Text style={styles.tipText}>Provide purchase proof if available (receipt photo, warranty card, order confirmation email screenshot)</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>6.</Text>
                    <Text style={styles.tipText}>Describe personal markings that aren't obvious from photos (hidden name tags, initials written inside, custom ringtone settings)</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>7.</Text>
                    <Text style={styles.tipText}>For electronics, mention account logins, saved photos/files, or specific apps installed that can be verified without accessing the device</Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>8.</Text>
                    <Text style={styles.tipText}>Combine multiple types of proof - physical + digital + documentation creates the strongest case for ownership verification</Text>
                  </View>
                </View>
              </View>

              {/* Multiple Claims Warning */}
              {hasMultipleClaims && (
                <View style={styles.multipleClaimsWarning}>
                  <View style={styles.warningHeader}>
                    <Ionicons name="warning" size={20} color="#ff6b6b" />
                    <Text style={styles.warningTitle}>⚠️ Multiple Claims Detected</Text>
                  </View>
                  <Text style={styles.warningText}>
                    <Text style={styles.warningBold}>{claimCount} {claimCount > 2 ? 'users have' : 'other user has'}</Text> also claimed this item. 
                    Your proof of ownership must be exceptionally specific to be approved.
                  </Text>
                  <View style={styles.warningDivider} />
                  <Text style={styles.warningSubtitle}>Make your claim stand out by providing:</Text>
                  <View style={styles.warningList}>
                    <View style={styles.warningItem}>
                      <Ionicons name="shield-checkmark" size={16} color="#ff6b6b" />
                      <Text style={styles.warningItemText}>Serial numbers, IMEI codes, or unique identifiers</Text>
                    </View>
                    <View style={styles.warningItem}>
                      <Ionicons name="shield-checkmark" size={16} color="#ff6b6b" />
                      <Text style={styles.warningItemText}>Photos of receipts, warranty cards, or purchase proof</Text>
                    </View>
                    <View style={styles.warningItem}>
                      <Ionicons name="shield-checkmark" size={16} color="#ff6b6b" />
                      <Text style={styles.warningItemText}>Details only the true owner would know (scratches, custom modifications, contents)</Text>
                    </View>
                    <View style={styles.warningItem}>
                      <Ionicons name="shield-checkmark" size={16} color="#ff6b6b" />
                      <Text style={styles.warningItemText}>High-quality photos showing all unique features clearly</Text>
                    </View>
                  </View>
                  <View style={styles.warningFooter}>
                    <Ionicons name="information-circle" size={16} color="#666" />
                    <Text style={styles.warningFooterText}>
                      The administrator will carefully compare all claims. Only the most convincing proof will be approved.
                    </Text>
                  </View>
                </View>
              )}
            </View>
            
            <Text style={styles.fieldLabel}>
              Describe how you can prove this item belongs to you:
            </Text>
            <View style={styles.proofTextContainer}>
              <TextInput
                style={styles.proofTextInput}
                placeholder="e.g., Serial number, unique features, purchase receipt details, etc."
                multiline={true}
                value={proofOfOwnershipText}
                onChangeText={setProofOfOwnershipText}
                placeholderTextColor="#aaa"
                textAlignVertical="top"
              />
            </View>
            
            <Text style={styles.fieldLabel}>
              Add a photo as proof (Important):
            </Text>
            
            <ImagePickerComponent 
              onImageSelected={handleImageSelected}
              onCategoriesDetected={handleCategoriesDetected}
              onObjectsDetected={handleObjectsDetected}
              onDescriptionGenerated={handleDescriptionGenerated}
            />
          </View>
          

          
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="list-outline" size={20} color="#3498db" style={{marginRight: 8}} />
              <Text style={styles.sectionTitle}>Claim Process</Text>
            </View>
            <View style={styles.processList}>
              <View style={styles.processItem}>
                <View style={styles.processNumberCircle}>
                  <Text style={styles.processNumber}>1</Text>
                </View>
                <Text style={styles.processText}>Provide detailed proof of ownership description</Text>
              </View>
              <View style={styles.processItem}>
                <View style={styles.processNumberCircle}>
                  <Text style={styles.processNumber}>2</Text>
                </View>
                <Text style={styles.processText}>Upload photo evidence of ownership (Important)</Text>
              </View>
              <View style={styles.processItem}>
                <View style={styles.processNumberCircle}>
                  <Text style={styles.processNumber}>3</Text>
                </View>
                <Text style={styles.processText}>Administrator reviews your request and verifies your proof of ownership</Text>
              </View>
              <View style={styles.processItem}>
                <View style={styles.processNumberCircle}>
                  <Text style={styles.processNumber}>4</Text>
                </View>
                <Text style={styles.processText}>If verified, you'll receive an email with instructions on how to collect your item. If not verified, you'll receive an email with reasons why.</Text>
              </View>
              <View style={styles.processItem}>
                <View style={styles.processNumberCircle}>
                  <Text style={styles.processNumber}>5</Text>
                </View>
                <Text style={styles.processText}>Visit the SSC office, theres a map location below to collect you loss item.</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="briefcase-outline" size={20} color="#3498db" style={{marginRight: 8}} />
              <Text style={styles.sectionTitle}>What to Bring</Text>
            </View>
            <Text style={styles.fieldLabel}>
              When your claim is approved, you'll need to bring these items to collect your lost item:
            </Text>
            <View style={styles.itemsList}>
              <View style={styles.itemRow}>
                <View style={styles.itemBullet}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.itemText}>Valid ID (School ID, Government ID)</Text>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemBullet}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.itemText}>Screenshot of Claim Approval</Text>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemBullet}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.itemText}>Showing your Match ID to the SSC: {matchId || 'N/A'}</Text>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemBullet}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.itemText}>Additional identification if requested</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.section}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="location-outline" size={20} color="#3498db" style={{marginRight: 8}} />
              <Text style={styles.sectionTitle}>Office Location</Text>
            </View>
            <View style={styles.mapContainer}>
              <View style={styles.staticMapContainer}>
                <Ionicons name="location" size={40} color="#3498db" style={styles.mapMarker} />
                <View style={styles.mapTextContainer}>
                  <Text style={styles.mapLocationTitle}>Supreme Student Council Office</Text>
                  <Text style={styles.mapLocationSubtitle}>13°24'23.2"N 123°22'31.4"E</Text>
                </View>
              </View>
              
              <TouchableOpacity style={styles.directionsButton} onPress={openMapsApp}>
                <Ionicons name="navigate" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.submitButton}
            disabled={submitting}
            onPress={handleSubmitClaimRequest}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.submitButtonText}>Submit Claim Request</Text>
              </>
            )}
          </TouchableOpacity>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Your request will be reviewed within 24-48 hours</Text>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      )}
      
      <ProfessionalAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onDismiss={hideAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 1,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#3498db',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  backButton: {
    padding: 8,
    paddingTop: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    paddingTop: 25,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#3498db',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  infoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    marginBottom: 0,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  fieldLabel: {
    fontSize: 15,
    color: '#555',
    marginBottom: 10,
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
    minHeight: 120,
    textAlignVertical: 'top',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  proofTextContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  proofTextInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
    maxHeight: 500,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  uniqueFeaturesCard: {
    backgroundColor: '#fffbf0',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f39c12',
    elevation: 2,
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  uniqueFeaturesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  uniqueFeaturesTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f39c12',
    flex: 1,
  },
  uniqueFeaturesSubtitle: {
    fontSize: 14,
    color: '#7f6b3e',
    marginBottom: 16,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  featureCategory: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f39c12',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 8,
  },
  featuresList: {
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  featureText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  proTipsContainer: {
    backgroundColor: '#fff9e6',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ffd966',
  },
  proTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  proTipsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#d68910',
    marginLeft: 6,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f39c12',
    width: 20,
  },
  tipText: {
    fontSize: 13,
    color: '#5a4a2f',
    flex: 1,
    lineHeight: 18,
  },

  multipleClaimsWarning: {
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#ff6b6b',
    elevation: 3,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginLeft: 8,
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    color: '#721c1c',
    lineHeight: 20,
    marginBottom: 12,
  },
  warningBold: {
    fontWeight: 'bold',
    color: '#d63031',
  },
  warningDivider: {
    height: 1,
    backgroundColor: '#ffcccb',
    marginVertical: 12,
  },
  warningSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#721c1c',
    marginBottom: 10,
  },
  warningList: {
    gap: 10,
    marginBottom: 12,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  warningItemText: {
    fontSize: 13,
    color: '#721c1c',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  warningFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffe0e0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  warningFooterText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
    fontStyle: 'italic',
  },

  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  staticMapContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  mapMarker: {
    marginRight: 16,
  },
  mapTextContainer: {
    flex: 1,
  },
  mapLocationTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  mapLocationSubtitle: {
    fontSize: 15,
    color: '#666',
  },
  directionsButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  directionsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  processList: {
    marginTop: 12,
  },
  processItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  processNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  processNumber: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  processText: {
    fontSize: 15,
    color: '#444',
    flex: 1,
    lineHeight: 22,
  },
  submitButton: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  itemsList: {
    marginTop: 10,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  itemBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3498db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  itemText: {
    fontSize: 15,
    color: '#444',
    flex: 1,
    lineHeight: 20,
  },
});

// Wrap ClaimItemScreen with internet guard to block access when offline
export default withInternetGuard(ClaimItemScreen);
