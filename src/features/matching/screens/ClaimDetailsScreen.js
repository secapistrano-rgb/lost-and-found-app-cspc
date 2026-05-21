import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Modal,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

const ClaimDetailsScreen = ({ navigation, route }) => {
  const { claim } = route.params || {};
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const styles = createStyles(insets);

  // SSC Office coordinates (13°24'23.2"N 123°22'31.4"E)
  const SSC_OFFICE_LAT = 13.406444;
  const SSC_OFFICE_LNG = 123.375389;

  // Function to open maps app with SSC office location
  const openMapsApp = () => {
    const label = 'Supreme Student Council Office';
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${SSC_OFFICE_LAT},${SSC_OFFICE_LNG}`,
      android: `geo:0,0?q=${SSC_OFFICE_LAT},${SSC_OFFICE_LNG}(${label})`
    });

    Linking.openURL(url).catch(err => {
      console.error('Error opening maps:', err);
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${SSC_OFFICE_LAT},${SSC_OFFICE_LNG}`);
    });
  };

  if (!claim) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Details</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No claim data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      case 'resolved': return '#17a2b8';
      default: return '#007bff';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'resolved': return 'shield-checkmark';
      default: return 'time';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#007bff', '#0056b3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Claim Details</Text>
          <Text style={styles.headerSubtitle}>ID: {claim.id?.substring(0, 8) || 'N/A'}</Text>
        </View>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Status Card */}
        <View style={[styles.statusCard, { borderLeftColor: getStatusColor(claim.status) }]}>
          <View style={styles.statusCardContent}>
            <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor(claim.status) + '20' }]}>
              <Ionicons name={getStatusIcon(claim.status)} size={32} color={getStatusColor(claim.status)} />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, { color: getStatusColor(claim.status) }]}>
                {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(claim.status) }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>
              {claim.status === 'pending' ? 'Under Review' :
               claim.status === 'approved' ? 'Ready for Collection' :
               claim.status === 'rejected' ? 'Not Approved' : 'Completed'}
            </Text>
          </View>
        </View>

        {/* Item Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="cube" size={22} color="#007bff" />
            </View>
            <Text style={styles.sectionTitle}>Item Information</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={18} color="#666" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.label}>Item Title</Text>
                <Text style={styles.value}>{claim.itemTitle || 'Unnamed Item'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="link" size={18} color="#666" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.label}>Match ID</Text>
                <Text style={styles.valueCode}>{claim.matchId || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Claimant Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Ionicons name="person" size={22} color="#28a745" />
            </View>
            <Text style={styles.sectionTitle}>Claimant Information</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person-circle" size={18} color="#666" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.label}>Full Name</Text>
                <Text style={styles.value}>{claim.userName || 'Unknown User'}</Text>
              </View>
            </View>
            {claim.userDepartment && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Ionicons name="business" size={18} color="#666" style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.label}>Department</Text>
                    <Text style={styles.value}>{claim.userDepartment}</Text>
                  </View>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={18} color="#666" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text style={styles.label}>Email Address</Text>
                <Text style={styles.valueCode}>{claim.googleUserId}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Ownership Information */}
        {(claim.isLostItemOwner || claim.isFoundItemOwner) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons 
                name={claim.isLostItemOwner ? "alert-circle-outline" : "checkmark-circle-outline"} 
                size={20} 
                color={claim.isLostItemOwner ? '#dc3545' : '#28a745'} 
              />
              <Text style={styles.sectionTitle}>Item Ownership</Text>
            </View>
            <View style={styles.ownershipBadge}>
              <Text style={[styles.ownershipText, { 
                color: claim.isLostItemOwner ? '#dc3545' : '#28a745' 
              }]}>
                {claim.isLostItemOwner ? 'Lost by this user' : 'Found by this user'}
              </Text>
            </View>
          </View>
        )}

        {/* Proof of Ownership */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color="#007bff" />
            <Text style={styles.sectionTitle}>Proof of Ownership</Text>
          </View>
          <View style={styles.proofContainer}>
            <Text style={styles.proofText}>
              {claim.proofOfOwnershipText || 'No proof of ownership provided'}
            </Text>
          </View>
          
          {/* Proof Image */}
          {claim.proofOfOwnershipImage && (
            <View style={styles.imageContainer}>
              <Text style={styles.imageLabel}>Proof Image:</Text>
              <TouchableOpacity 
                style={styles.imageWrapper}
                onPress={() => setIsImageModalVisible(true)}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ 
                    uri: claim.proofOfOwnershipImage
                  }} 
                  style={styles.proofImage}
                  resizeMode="contain"
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand-outline" size={24} color="#fff" />
                  <Text style={styles.expandText}>Tap to view full size</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Timestamps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color="#007bff" />
            <Text style={styles.sectionTitle}>Timeline</Text>
          </View>
          
          {/* Timeline Items */}
          <View style={styles.timelineContainer}>
            {/* Submitted */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot}>
                <Ionicons name="create-outline" size={16} color="#007bff" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Submitted</Text>
                <Text style={styles.timelineDate}>{formatDate(claim.createdAt)}</Text>
              </View>
            </View>
            
            {/* Claimed (only for resolved status) */}
            {claim.status === 'resolved' && claim.updatedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, styles.timelineDotResolved]}>
                  <Ionicons name="checkmark-done" size={16} color="#17a2b8" />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Claimed</Text>
                  <Text style={styles.timelineDate}>{formatDate(claim.updatedAt)}</Text>
                </View>
              </View>
            )}
            
            {/* Last Updated */}
            {claim.updatedAt && claim.updatedBy && (
              <View style={[styles.timelineItem, styles.timelineItemLast]}>
                <View style={styles.timelineDot}>
                  <Ionicons name="sync-outline" size={16} color="#6c757d" />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Last Updated</Text>
                  <Text style={styles.timelineDate}>
                    {formatDate(claim.updatedAt)}
                  </Text>
                  <Text style={styles.timelineBy}>
                    by {claim.updatedBy.name || claim.updatedBy.email}
                    {claim.updatedBy.isAdmin ? ' (Admin)' : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Additional Information */}
        {claim.claimType && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={20} color="#007bff" />
              <Text style={styles.sectionTitle}>Additional Information</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Claim Type:</Text>
              <Text style={styles.value}>{claim.claimType}</Text>
            </View>
          </View>
        )}

        {/* Item Retrieval Instructions - Only show when claim is approved */}
        {claim.status === 'approved' && (
          <>
            {/* What to Bring Section */}
            <View style={[styles.section, styles.approvedSection]}>
              <View style={styles.approvedHeader}>
                <Ionicons name="checkmark-circle" size={24} color="#28a745" />
                <Text style={styles.approvedHeaderText}>Claim Approved!</Text>
              </View>
              <View style={styles.sectionHeader}>
                <Ionicons name="briefcase-outline" size={20} color="#28a745" />
                <Text style={[styles.sectionTitle, { color: '#28a745' }]}>What to Bring</Text>
              </View>
              <Text style={styles.instructionText}>
                Please bring the following items when collecting your lost item at the SSC Office:
              </Text>
              <View style={styles.checklistContainer}>
                <View style={styles.checklistItem}>
                  <View style={styles.checklistBullet}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={styles.checklistText}>Valid ID (School ID or Government ID)</Text>
                </View>
                <View style={styles.checklistItem}>
                  <View style={styles.checklistBullet}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={styles.checklistText}>Screenshot of this claim approval</Text>
                </View>
                <View style={styles.checklistItem}>
                  <View style={styles.checklistBullet}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={styles.checklistText}>
                    Your Match ID: <Text style={styles.matchIdText}>{claim.matchId || claim.id}</Text>
                  </Text>
                </View>
                <View style={styles.checklistItem}>
                  <View style={styles.checklistBullet}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={styles.checklistText}>Additional identification if requested</Text>
                </View>
              </View>
            </View>

            {/* Office Location Section */}
            <View style={[styles.section, styles.locationSection]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location" size={20} color="#dc3545" />
                <Text style={[styles.sectionTitle, { color: '#dc3545' }]}>Office Location</Text>
              </View>
              <Text style={styles.instructionText}>
                Visit the Supreme Student Council Office to collect your item:
              </Text>
              
              <View style={styles.mapContainer}>
                <View style={styles.staticMapContainer}>
                  <Ionicons name="location" size={40} color="#dc3545" style={styles.mapMarker} />
                  <View style={styles.mapTextContainer}>
                    <Text style={styles.mapLocationTitle}>Supreme Student Council Office</Text>
                    <Text style={styles.mapLocationSubtitle}>13°24'23.2"N 123°22'31.4"E</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.directionsButton} 
                  onPress={openMapsApp}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.directionsButtonText}>Get Directions</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.officeHoursContainer}>
                <Ionicons name="time-outline" size={18} color="#666" />
                <View style={styles.officeHoursText}>
                  <Text style={styles.officeHoursLabel}>Office Hours:</Text>
                  <Text style={styles.officeHoursValue}>Monday - Friday, 8:00 AM - 5:00 PM</Text>
                </View>
              </View>
            </View>

            {/* Important Reminder */}
            <View style={[styles.section, styles.reminderSection]}>
              <View style={styles.reminderHeader}>
                <Ionicons name="alert-circle" size={20} color="#ffc107" />
                <Text style={styles.reminderTitle}>Important Reminder</Text>
              </View>
              <Text style={styles.reminderText}>
                • Check your email for appointment confirmation from SSC staff{'\n'}
                • Bring all required documents listed above{'\n'}
                • Item must be collected promptly upon approval{'\n'}
                • Contact SSC if you have any questions
              </Text>
            </View>
          </>
        )}

        {/* Rejection Reason - Show for rejected claims */}
        {claim.status === 'rejected' && claim.rejection_reason && (
          <View style={[styles.section, styles.rejectionSection]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={20} color="#dc3545" />
              <Text style={[styles.sectionTitle, { color: '#dc3545' }]}>Rejection Reason</Text>
            </View>
            <Text style={styles.rejectionText}>{claim.rejection_reason}</Text>
            {claim.rejection_reason.includes('expired') && (
              <View style={styles.resubmitContainer}>
                <Ionicons name="refresh" size={18} color="#007bff" />
                <Text style={styles.resubmitText}>
                  You can submit a new claim request if the item is still available.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setIsImageModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Full Screen Image */}
            <View style={styles.fullImageContainer}>
              <Image 
                source={{ 
                  uri: claim.proofOfOwnershipImage
                }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>

            {/* Image Info */}
            <View style={styles.imageInfo}>
              <Text style={styles.imageInfoText}>Proof of Ownership</Text>
              <Text style={styles.imageInfoSubtext}>Pinch to zoom • Tap outside to close</Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 36,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  placeholder: {
    width: 42,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40 + (insets?.bottom || 0),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderLeftWidth: 6,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  infoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 22,
    fontWeight: '500',
  },
  valueCode: {
    fontSize: 14,
    color: '#007bff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  ownershipBadge: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  ownershipText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  proofContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  proofText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  imageContainer: {
    marginTop: 12,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullImageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  imageInfo: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  imageInfoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  imageInfoSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  // Approved claim sections
  approvedSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  approvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  approvedHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#28a745',
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  checklistContainer: {
    marginTop: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  checklistBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checklistText: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  matchIdText: {
    fontWeight: 'bold',
    color: '#007bff',
  },
  locationSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  mapContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  staticMapContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  mapMarker: {
    marginRight: 12,
  },
  mapTextContainer: {
    flex: 1,
  },
  mapLocationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  mapLocationSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  directionsButton: {
    backgroundColor: '#007bff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  directionsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  officeHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  officeHoursText: {
    marginLeft: 8,
    flex: 1,
  },
  officeHoursLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  officeHoursValue: {
    fontSize: 14,
    color: '#2c3e50',
  },
  reminderSection: {
    backgroundColor: '#fffbf0',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginLeft: 8,
  },
  reminderText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 22,
  },
  // Rejection section styles
  rejectionSection: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  rejectionText: {
    fontSize: 14,
    color: '#721c24',
    lineHeight: 20,
    marginBottom: 12,
  },
  resubmitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  resubmitText: {
    fontSize: 14,
    color: '#007bff',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  // Timeline styles
  timelineContainer: {
    marginTop: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    position: 'relative',
  },
  timelineItemLast: {
    marginBottom: 0,
  },
  timelineDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#007bff',
  },
  timelineDotResolved: {
    backgroundColor: '#d1ecf1',
    borderColor: '#17a2b8',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '500',
    lineHeight: 20,
  },
  timelineBy: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default withInternetGuard(ClaimDetailsScreen);