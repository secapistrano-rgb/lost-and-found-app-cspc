import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  SafeAreaView,
  Linking,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getUser } from '../../../shared/storage/storage';
import { submitSupportTicket, uploadFile, getSupportTickets, getSupportTicketById } from '../../../config/apiConfig';

// localViolationTracker removed - violation tracking handled elsewhere

import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';

const HelpSupportScreen = ({ navigation }) => {
  const [activeSection, setActiveSection] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Support ticket form states
  const [ticketForm, setTicketForm] = useState({
    issueType: '',
    subject: '',
    description: '',
    priority: 'medium',
    attachment: null,
    attachmentName: '',
    attachmentSize: 0
  });
  const [showIssueTypeModal, setShowIssueTypeModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  
  // Ticket history states
  const [userTickets, setUserTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showTicketDetailModal, setShowTicketDetailModal] = useState(false);
  const [isInitialTicketLoad, setIsInitialTicketLoad] = useState(true);
  
  const { alertConfig, showError, showSuccess, showInfo, hideAlert } = useProfessionalAlert();
  const styles = createStyles();
  
  const issueTypes = [
    { id: 'technical_issue', label: 'Technical Issue', icon: 'bug-outline' },
    { id: 'account_problem', label: 'Account Problem', icon: 'person-outline' },
    { id: 'matching_system', label: 'Matching System', icon: 'link-outline' },
    { id: 'item_report_issue', label: 'Item Report Issue', icon: 'document-outline' },
    { id: 'notification_problem', label: 'Notification Problem', icon: 'notifications-outline' },
    { id: 'other', label: 'Other', icon: 'help-outline' }
  ];
  
  const priorityLevels = [
    { id: 'low', label: 'Low', color: '#28a745', description: 'General questions or minor issues' },
    { id: 'medium', label: 'Medium', color: '#ffc107', description: 'Issues affecting functionality' },
    { id: 'high', label: 'High', color: '#fd7e14', description: 'Important issues needing prompt attention' },
    { id: 'urgent', label: 'Urgent', color: '#dc3545', description: 'Critical issues requiring immediate attention' }
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  // Auto-refresh tickets every 2 seconds
  useEffect(() => {
    if (!userData?.email) return;

    // Initial load
    fetchUserTickets(userData.email, true);

    // Set up interval for auto-refresh
    const intervalId = setInterval(() => {
      fetchUserTickets(userData.email, false);
    }, 2000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [userData?.email]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const user = await getUser();
      if (user) {
        // Ensure we have the photoURL from the Gmail user profile
        const updatedUserData = {
          ...user,
          // Use profileImage field if it exists (from Gmail login) or fallback to photoURL
          photoURL: user.profileImage || user.photoURL || null
        };
        setUserData(updatedUserData);

        // Note: Tickets will be loaded by the auto-refresh useEffect

      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const fetchUserTickets = async (userEmail = null, showLoading = false) => {
    try {
      const email = userEmail || userData?.email;
      if (!email) {
        console.log('No user email available to fetch tickets');
        return;
      }

      // Only show loading indicator on initial load
      if (showLoading && isInitialTicketLoad) {
        setLoadingTickets(true);
      }
      
      // Fetch tickets for this user
      const response = await getSupportTickets({ 
        user_email: email,
        limit: 50,
        page: 1
      });
      
      if (response && response.tickets) {
        // Sort by created_at descending (newest first)
        const sortedTickets = response.tickets.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setUserTickets(sortedTickets);
      } else {
        setUserTickets([]);
      }
      
      // Mark that initial load is complete
      if (isInitialTicketLoad) {
        setIsInitialTicketLoad(false);
      }
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      if (isInitialTicketLoad) {
        setUserTickets([]);
      }
      // Don't clear tickets on auto-refresh errors to prevent flickering
    } finally {
      if (showLoading) {
        setLoadingTickets(false);
      }
    }
  };

  const viewTicketDetails = async (ticket) => {
    try {
      setSelectedTicket(ticket);
      setShowTicketDetailModal(true);
      
      // Optionally fetch full ticket details with responses
      const fullTicket = await getSupportTicketById(ticket.id);
      if (fullTicket && fullTicket.ticket) {
        setSelectedTicket(fullTicket.ticket);
      }
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      // Still show the modal with basic info
    }
  };

  
  const toggleSection = (sectionId) => {
    if (activeSection === sectionId) {
      setActiveSection(null);
    } else {
      setActiveSection(sectionId);
    }
  };

  // Helper functions for ticket display
  const getStatusColor = (status) => {
    const colors = {
      'open': '#007bff',
      'in_progress': '#ffc107',
      'resolved': '#28a745',
      'closed': '#6c757d',
      'pending': '#fd7e14'
    };
    return colors[status] || '#6c757d';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': '#28a745',
      'medium': '#ffc107',
      'high': '#fd7e14',
      'urgent': '#dc3545'
    };
    return colors[priority] || '#ffc107';
  };

  const getCategoryLabel = (category) => {
    const found = issueTypes.find(type => type.id === category);
    return found ? found.label : category;
  };

  const formatTicketDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const openEmail = () => {
    Linking.openURL('mailto:support@lostandfound.com?subject=Support%20Request');
  };

  const openPhone = () => {
    Linking.openURL('tel:+1234567890');
  };
  
  // Support ticket form handlers
  const updateTicketForm = (field, value) => {
    setTicketForm(prev => ({ ...prev, [field]: value }));
  };
  
  const validateTicketForm = () => {
    if (!ticketForm.issueType) {
      showError('Validation Error', 'Please select an issue type.');
      return false;
    }
    if (!ticketForm.subject.trim()) {
      showError('Validation Error', 'Please enter a subject for your ticket.');
      return false;
    }
    if (!ticketForm.description.trim()) {
      showError('Validation Error', 'Please provide a description of your issue.');
      return false;
    }
    if (ticketForm.subject.trim().length < 5) {
      showError('Validation Error', 'Subject must be at least 5 characters long.');
      return false;
    }
    if (ticketForm.description.trim().length < 10) {
      showError('Validation Error', 'Description must be at least 10 characters long.');
      return false;
    }
    return true;
  };
  
  const handleSubmitSupportTicket = async () => {
    if (!validateTicketForm()) return;
    
    setIsSubmittingTicket(true);
    
    // Show immediate feedback
    showInfo(
      'Submitting...',
      'Please wait while we submit your support ticket.',
      [{ text: 'OK', onPress: hideAlert }]
    );
    
    try {
      // Check for potential spam in the ticket content
      const isSpamReport = await detectSpamReport(ticketForm.subject, ticketForm.description);
      
      if (isSpamReport) {
        // Spam violation tracking removed - detection still works but violations not tracked locally
        
        showError(
          'Report Flagged',
          'Your report has been flagged as potential spam. Repeated spam reports may result in account suspension. Please ensure your reports are legitimate.',
          [{ text: 'OK', onPress: hideAlert }]
        );
        return;
      }
      
      // Upload attachment file first if present
      let uploadedFileUrl = null;
      let uploadedFileName = null;
      
      if (ticketForm.attachment && ticketForm.attachmentName) {
        try {
          showInfo(
            'Uploading File...',
            'Please wait while we upload your attachment.',
            [{ text: 'OK', onPress: hideAlert }]
          );
          
          // Get file info from the URI
          const fileInfo = await FileSystem.getInfoAsync(ticketForm.attachment);
          
          if (!fileInfo.exists) {
            throw new Error('File not found');
          }
          
          // Determine MIME type based on file extension
          const extension = ticketForm.attachmentName.toLowerCase().split('.').pop();
          const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed'
          };
          
          const mimeType = mimeTypes[extension] || 'application/octet-stream';
          
          // Upload the file to the server
          const uploadResult = await uploadFile({
            uri: ticketForm.attachment,
            name: ticketForm.attachmentName,
            type: mimeType
          });
          
          if (uploadResult.success) {
            uploadedFileUrl = uploadResult.fileUrl;
            uploadedFileName = uploadResult.originalName;
            console.log('File uploaded successfully:', uploadedFileUrl);
          } else {
            throw new Error('Upload failed');
          }
        } catch (uploadError) {
          console.error('Error uploading file:', uploadError);
          showError(
            'Upload Failed',
            `Failed to upload attachment: ${uploadError.message}. Your ticket will be submitted without the attachment.`,
            [{ text: 'Continue', onPress: hideAlert }]
          );
          // Continue without attachment
        }
      }
      
      // Prepare ticket data for API submission (don't include id, API generates it)
      const ticketData = {
        user_id: userData?.id || 'unknown',
        user_email: userData?.email || 'unknown@example.com',
        user_name: userData?.displayName || userData?.name || 'Unknown User',
        user_department: userData?.department || null,
        subject: ticketForm.subject,
        description: ticketForm.description,
        category: ticketForm.issueType,
        priority: ticketForm.priority,
        attachment_url: uploadedFileUrl || ticketForm.attachment,
        attachment_filename: uploadedFileName || ticketForm.attachmentName || null
      };

      // Submit ticket to API using helper function
      let result;
      try {
        result = await submitSupportTicket(ticketData);
      } catch (apiError) {
        throw new Error(`Failed to submit ticket: ${apiError.message}`);
      }
      
      const selectedIssueType = issueTypes.find(type => type.id === ticketForm.issueType);
      const selectedPriority = priorityLevels.find(priority => priority.id === ticketForm.priority);
      const hasAttachment = uploadedFileUrl || (ticketForm.attachment && ticketForm.attachmentName);
      
      // Reset form
      setTicketForm({
        issueType: '',
        subject: '',
        description: '',
        priority: 'medium',
        attachment: null,
        attachmentName: '',
        attachmentSize: 0
      });
      
      const attachmentNote = hasAttachment ? ' Your attached file has been included with the ticket.' : '';
      
      // Refresh ticket list immediately (will continue auto-refreshing)
      await fetchUserTickets(userData?.email, false);
      
      showSuccess(
        'Ticket Submitted',
        `Your support ticket (ID: ${result.ticket.id}) has been submitted successfully. We'll respond to your ${selectedPriority.label.toLowerCase()} priority ${selectedIssueType.label.toLowerCase()} within 24-48 hours.${attachmentNote}`,
        [{ text: 'OK', onPress: hideAlert }]
      );
      
    } catch (error) {
      console.error('Error submitting support ticket:', error);
      showError(
        'Submission Failed',
        `Unable to submit your support ticket. Error: ${error.message || 'Unknown error'}. Please try again or contact us directly.`,
        [{ text: 'OK', onPress: hideAlert }]
      );
    } finally {
      setIsSubmittingTicket(false);
    }
  };
  
  // Simple spam detection function
  const detectSpamReport = async (subject, description) => {
    const spamKeywords = [
      'test', 'testing', 'spam', 'fake', 'dummy', 'asdf', 'qwerty',
      'aaaa', 'bbbb', 'cccc', 'dddd', 'eeee', 'ffff', 'gggg',
      'hhhh', 'iiii', 'jjjj', 'kkkk', 'llll', 'mmmm', 'nnnn'
    ];
    
    const content = (subject + ' ' + description).toLowerCase();
    
    // Check for spam patterns
    const hasSpamKeywords = spamKeywords.some(keyword => content.includes(keyword));
    const hasRepeatedChars = /([a-z])\1{4,}/i.test(content);
    const isVeryShort = content.trim().length < 15;
    const hasExcessivePunctuation = (content.match(/[!@#$%^&*()]/g) || []).length > 5;
    
    return hasSpamKeywords || hasRepeatedChars || (isVeryShort && hasExcessivePunctuation);
  };
  
  const getSelectedIssueTypeLabel = () => {
    const selected = issueTypes.find(type => type.id === ticketForm.issueType);
    return selected ? selected.label : 'Select Issue Type';
  };
  
  const getSelectedPriorityLabel = () => {
    const selected = priorityLevels.find(priority => priority.id === ticketForm.priority);
    return selected ? selected.label : 'Medium';
  };

  // Attachment handling functions
  const selectAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'], // Allow all file types
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Check file size (limit to 10MB)
        const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSizeInBytes) {
          showError(
            'File Too Large', 
            'Please select a file smaller than 10MB.',
            [{ text: 'OK', onPress: hideAlert }]
          );
          return;
        }

        // Validate file type (server will also validate)
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'csv', 'zip', 'rar'];
        const extension = file.name.toLowerCase().split('.').pop();
        
        if (!allowedExtensions.includes(extension)) {
          showError(
            'Invalid File Type',
            'Please select a valid file type: images, PDFs, documents, spreadsheets, text files, or archives.',
            [{ text: 'OK', onPress: hideAlert }]
          );
          return;
        }

        // Update form with attachment info
        setTicketForm(prev => ({
          ...prev,
          attachment: file.uri,
          attachmentName: file.name,
          attachmentSize: file.size
        }));

        showSuccess(
          'File Selected',
          `${file.name} has been attached. It will be uploaded when you submit the ticket.`,
          [{ text: 'OK', onPress: hideAlert }]
        );
      }
    } catch (error) {
      console.error('Error selecting attachment:', error);
      showError(
        'Selection Failed',
        'Unable to select file. Please try again.',
        [{ text: 'OK', onPress: hideAlert }]
      );
    }
  };

  const removeAttachment = () => {
    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove the selected file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setTicketForm(prev => ({
              ...prev,
              attachment: null,
              attachmentName: '',
              attachmentSize: 0
            }));
          }
        }
      ]
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf':
        return 'document-text-outline';
      case 'doc':
      case 'docx':
        return 'document-outline';
      case 'xls':
      case 'xlsx':
        return 'grid-outline';
      case 'ppt':
      case 'pptx':
        return 'easel-outline';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image-outline';
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'videocam-outline';
      case 'mp3':
      case 'wav':
        return 'musical-notes-outline';
      case 'zip':
      case 'rar':
        return 'archive-outline';
      default:
        return 'attach-outline';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>
      
      {userData && (
        <View style={styles.userInfoContainer}>
          {userData.photoURL ? (
            <Image 
              source={{ uri: userData.photoURL }} 
              style={styles.userAvatar} 
              onError={(e) => {
                console.error('Error loading profile image:', e.nativeEvent.error);
                // If profileImage exists and is different from photoURL, try using it as fallback
                if (userData.profileImage && userData.profileImage !== userData.photoURL) {
                  userData.photoURL = userData.profileImage;
                  setUserData({...userData});
                }
              }}
            />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Text style={styles.userInitials}>
                {userData.displayName?.charAt(0) || userData.name?.charAt(0) || userData.email?.charAt(0) || 'U'}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{userData.displayName || userData.name || 'User'}</Text>
            <Text style={styles.userEmail}>{userData.email}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
      <ScrollView style={styles.scrollView}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq1')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>How do I report a lost or found item?</Text>
              <Ionicons 
                name={activeSection === 'faq1' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq1' && (
              <Text style={styles.faqAnswer}>
                To report an item, tap the "Report Item" button on the home screen. Select whether 
                it's a "Lost" or "Found" item. Fill in the required details including item category, 
                description, location, and date. You can upload up to 3 photos to help identify the 
                item. Add any distinguishing features or additional information that might help match 
                your item. Once submitted, our AI-powered matching system will automatically search 
                for potential matches and notify you if any are found.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq2')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>How does the AI matching system work?</Text>
              <Ionicons 
                name={activeSection === 'faq2' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq2' && (
              <Text style={styles.faqAnswer}>
                Our advanced AI matching system analyzes multiple factors to find potential matches: 
                {'\n\n'}• Image Recognition: Compares uploaded photos using computer vision
                {'\n'}• Text Analysis: Matches keywords in descriptions and item details
                {'\n'}• Location Proximity: Considers where items were lost/found
                {'\n'}• Time Window: Matches items based on reported dates
                {'\n'}• Category & Features: Compares item types and characteristics
                {'\n\n'}When a potential match is found (confidence score above 60%), both parties 
                receive push notifications with match details. You can view all matches in the 
                "Matches" tab and initiate claims for items that belong to you.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq3')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>What is the claims process and how do I claim an item?</Text>
              <Ionicons 
                name={activeSection === 'faq3' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq3' && (
              <Text style={styles.faqAnswer}>
                To claim an item:{'\n\n'}
                1. Browse matched items in the "Matches" tab or search for your lost item{'\n'}
                2. Tap on the item to view full details and photos{'\n'}
                3. If it's your item, tap "Claim This Item"{'\n'}
                4. Provide verification details (purchase proof, serial numbers, unique features, etc.){'\n'}
                5. Submit your claim for review{'\n\n'}
                The finder will review your claim and can approve or deny it. If approved, you'll 
                receive the finder's contact information to arrange pickup. Claim status updates are 
                sent via push notifications. You can track all your claims in the "My Claims" section 
                of your profile.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq4')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>How do push notifications work?</Text>
              <Ionicons 
                name={activeSection === 'faq4' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq4' && (
              <Text style={styles.faqAnswer}>
                The app sends real-time push notifications for important events:{'\n\n'}
                • New Matches: When your lost/found item matches with another report{'\n'}
                • Claim Updates: When someone claims your found item or responds to your claim{'\n'}
                • Status Changes: When claims are approved, denied, or marked as resolved{'\n'}
                • Support Responses: When support team responds to your tickets{'\n\n'}
                Tapping a notification takes you directly to the relevant section. You can customize 
                notification preferences in Settings {'>'} Notifications. Make sure to allow notifications 
                when first launching the app for the best experience.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq5')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>How can I track my support tickets?</Text>
              <Ionicons 
                name={activeSection === 'faq5' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq5' && (
              <Text style={styles.faqAnswer}>
                The "My Support Tickets" section at the top of this screen shows all your submitted 
                support tickets with real-time status updates every 2 seconds. Each ticket displays:{'\n\n'}
                • Ticket ID and current status (Open, In Progress, Resolved, Closed){'\n'}
                • Priority level (Low, Medium, High, Urgent){'\n'}
                • Subject and description preview{'\n'}
                • Submission date and last update{'\n'}
                • Attachment indicator if files were included{'\n\n'}
                Tap any ticket to view full details, attached files, and support team responses. 
                You'll receive push notifications when your ticket status changes or when support 
                responds. Average response time is 24-48 hours depending on priority level.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq6')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>What should I do if I find a suspicious or spam report?</Text>
              <Ionicons 
                name={activeSection === 'faq6' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq6' && (
              <Text style={styles.faqAnswer}>
                If you encounter suspicious reports, spam, or inappropriate content:{'\n\n'}
                1. Tap the item to view details{'\n'}
                2. Use the "Report" button to flag the content{'\n'}
                3. Select the reason (Spam, Inappropriate, Fraudulent, etc.){'\n'}
                4. Provide additional details if needed{'\n\n'}
                Our moderation team reviews all reports within 24 hours. Users who violate community 
                guidelines may receive warnings or suspensions. We use spam detection algorithms to 
                automatically flag potential spam reports during submission. Your safety and the 
                community's integrity are our top priorities.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq7')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>Is my personal information secure and private?</Text>
              <Ionicons 
                name={activeSection === 'faq7' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq7' && (
              <Text style={styles.faqAnswer}>
                Yes, we take your privacy and security seriously:{'\n\n'}
                • End-to-end Encryption: All data is encrypted in transit and at rest{'\n'}
                • Secure Authentication: Firebase authentication with Google Sign-In{'\n'}
                • Limited Sharing: Contact info only shared when claims are approved{'\n'}
                • No Public Profiles: Your email and phone are never publicly visible{'\n'}
                • Data Control: You can delete your account and data anytime{'\n'}
                • Secure Storage: Images and files stored on secure servers{'\n\n'}
                We comply with data protection regulations and never sell your information to third 
                parties. Review our Privacy Policy in Settings for complete details about data handling.
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.faqItem}
            onPress={() => toggleSection('faq8')}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>How do I improve my chances of finding my lost item?</Text>
              <Ionicons 
                name={activeSection === 'faq8' ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#666" 
              />
            </View>
            
            {activeSection === 'faq8' && (
              <Text style={styles.faqAnswer}>
                To maximize your chances of recovery:{'\n\n'}
                • Upload Clear Photos: Take multiple angles showing unique features{'\n'}
                • Be Detailed: Include brand, model, color, size, and distinguishing marks{'\n'}
                • Accurate Location: Specify exact location where item was lost{'\n'}
                • Report Quickly: Submit your report as soon as possible{'\n'}
                • Check Regularly: Browse the "Browse" tab daily for new matches{'\n'}
                • Enable Notifications: Allow push notifications for instant match alerts{'\n'}
                • Update Status: Mark items as found when recovered{'\n'}
                • Be Responsive: Reply promptly to match notifications and claims{'\n\n'}
                The more information you provide, the better our AI can match your item!
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Submit Support Ticket</Text>
          
          <View style={styles.ticketForm}>
            {/* Issue Type Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Issue Type *</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowIssueTypeModal(true)}
              >
                <Text style={[styles.selectorText, !ticketForm.issueType && styles.placeholderText]}>
                  {getSelectedIssueTypeLabel()}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Subject Input */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subject *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Brief description of your issue"
                value={ticketForm.subject}
                onChangeText={(text) => updateTicketForm('subject', text)}
                maxLength={100}
              />
              <Text style={styles.characterCount}>{ticketForm.subject.length}/100</Text>
            </View>
            
            {/* Priority Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Priority</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => setShowPriorityModal(true)}
              >
                <View style={styles.prioritySelector}>
                  <View style={[
                    styles.priorityIndicator, 
                    { backgroundColor: priorityLevels.find(p => p.id === ticketForm.priority)?.color || '#ffc107' }
                  ]} />
                  <Text style={styles.selectorText}>{getSelectedPriorityLabel()}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Description Input */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Please provide detailed information about your issue..."
                value={ticketForm.description}
                onChangeText={(text) => updateTicketForm('description', text)}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{ticketForm.description.length}/500</Text>
            </View>

            {/* Attachment Section */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Attachment (Optional)</Text>
              
              {!ticketForm.attachment ? (
                // No attachment selected - show add button
                <TouchableOpacity 
                  style={styles.attachmentButton}
                  onPress={selectAttachment}
                >
                  <Ionicons name="attach" size={20} color="#3266a8" />
                  <Text style={styles.attachmentButtonText}>Add File</Text>
                  <Text style={styles.attachmentHint}>Max 10MB - Any file type</Text>
                </TouchableOpacity>
              ) : (
                // Attachment selected - show file info with remove option
                <View style={styles.attachmentContainer}>
                  <View style={styles.attachmentInfo}>
                    <Ionicons 
                      name={getFileIcon(ticketForm.attachmentName)} 
                      size={24} 
                      color="#3266a8" 
                    />
                    <View style={styles.attachmentDetails}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {ticketForm.attachmentName}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {formatFileSize(ticketForm.attachmentSize)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.removeAttachmentButton}
                      onPress={removeAttachment}
                    >
                      <Ionicons name="close-circle" size={24} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            
            {/* Submit Button */}
             <TouchableOpacity 
               style={[styles.submitButton, isSubmittingTicket && styles.submitButtonDisabled]}
               onPress={handleSubmitSupportTicket}
               disabled={isSubmittingTicket}
             >
               {isSubmittingTicket ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
               <Text style={styles.submitButtonText}>
                 {isSubmittingTicket ? 'Submitting...' : 'Submit Ticket'}
               </Text>
             </TouchableOpacity>
             
             {/* Ticket Reply Information */}
             <View style={styles.replyInfoContainer}>
               <View style={styles.replyInfoHeader}>
                 <Ionicons name="information-circle-outline" size={20} color="#007bff" />
                 <Text style={styles.replyInfoTitle}>How to track your ticket</Text>
               </View>
               <Text style={styles.replyInfoText}>
                 After submitting your ticket, you will receive replies and updates via:
               </Text>
               <View style={styles.replyMethodsList}>
                 <View style={styles.replyMethod}>
                   <Ionicons name="mail-outline" size={16} color="#666" />
                   <Text style={styles.replyMethodText}>Email notifications to your registered email address</Text>
                 </View>
               </View>
               <Text style={styles.replyInfoNote}>
                 💡 Tip: Keep your email notifications enabled to receive prompt responses from our support team.
               </Text>
             </View>
           </View>
        </View>

         {/* My Support Tickets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Support Tickets</Text>
          
          {loadingTickets ? (
            <View style={styles.ticketsLoadingContainer}>
              <ActivityIndicator size="small" color="#007bff" />
              <Text style={styles.ticketsLoadingText}>Loading your tickets...</Text>
            </View>
          ) : userTickets.length === 0 ? (
            <View style={styles.noTicketsContainer}>
              <Ionicons name="ticket-outline" size={48} color="#ccc" />
              <Text style={styles.noTicketsText}>No support tickets yet</Text>
              <Text style={styles.noTicketsSubtext}>Submit a ticket below if you need help</Text>
            </View>
          ) : (
            <View style={styles.ticketsContainer}>
              {userTickets.map((ticket) => (
                <TouchableOpacity
                  key={ticket.id}
                  style={styles.ticketCard}
                  onPress={() => viewTicketDetails(ticket)}
                >
                  <View style={styles.ticketCardHeader}>
                    <View style={styles.ticketIdContainer}>
                      <Ionicons name="ticket" size={16} color="#666" />
                      <Text style={styles.ticketId}>{ticket.id}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: getStatusColor(ticket.status) }
                    ]}>
                      <Text style={styles.statusText}>{ticket.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  
                  <Text style={styles.ticketDescription} numberOfLines={2}>
                    {ticket.description}
                  </Text>
                  
                  <View style={styles.ticketCardFooter}>
                    <View style={styles.ticketMeta}>
                      <View style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(ticket.priority) }
                      ]}>
                        <Text style={styles.priorityText}>{ticket.priority}</Text>
                      </View>
                      <Text style={styles.ticketCategory}>
                        {getCategoryLabel(ticket.category)}
                      </Text>
                    </View>
                    <Text style={styles.ticketDate}>
                      {formatTicketDate(ticket.created_at)}
                    </Text>
                  </View>
                  
                  {ticket.attachment_url && (
                    <View style={styles.attachmentIndicator}>
                      <Ionicons name="attach" size={14} color="#666" />
                      <Text style={styles.attachmentText}>Has attachment</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          
          <View style={styles.contactOptions}>
            <TouchableOpacity 
              style={styles.contactOption}
              onPress={openEmail}
            >
              <View style={[styles.contactIconContainer, { backgroundColor: '#f0f0f0' }]}>
                <Ionicons name="mail-outline" size={24} color="#007bff" />
              </View>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>support@lostandfound.com</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.contactOption}
              onPress={openPhone}
            >
              <View style={[styles.contactIconContainer, { backgroundColor: '#f0f0f0' }]}>
                <Ionicons name="call-outline" size={24} color="#28a745" />
              </View>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>+1 (234) 567-890</Text>
            </TouchableOpacity>
          </View>
        </View>


        

      </ScrollView>
      )}
      
      <ProfessionalAlert
         visible={alertConfig.visible}
         type={alertConfig.type}
         title={alertConfig.title}
         message={alertConfig.message}
         buttons={alertConfig.buttons}
         onDismiss={hideAlert}
       />
       
       {/* Issue Type Modal */}
       <Modal
         visible={showIssueTypeModal}
         transparent
         animationType="slide"
         onRequestClose={() => setShowIssueTypeModal(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Select Issue Type</Text>
               <TouchableOpacity onPress={() => setShowIssueTypeModal(false)}>
                 <Ionicons name="close" size={24} color="#666" />
               </TouchableOpacity>
             </View>
             <FlatList
               data={issueTypes}
               keyExtractor={(item) => item.id}
               renderItem={({ item }) => (
                 <TouchableOpacity
                   style={[
                     styles.modalOption,
                     ticketForm.issueType === item.id && styles.modalOptionSelected
                   ]}
                   onPress={() => {
                     updateTicketForm('issueType', item.id);
                     setShowIssueTypeModal(false);
                   }}
                 >
                   <Ionicons name={item.icon} size={24} color={ticketForm.issueType === item.id ? '#007bff' : '#666'} />
                   <Text style={[
                     styles.modalOptionText,
                     ticketForm.issueType === item.id && styles.modalOptionTextSelected
                   ]}>
                     {item.label}
                   </Text>
                   {ticketForm.issueType === item.id && (
                     <Ionicons name="checkmark" size={20} color="#007bff" />
                   )}
                 </TouchableOpacity>
               )}
             />
           </View>
         </View>
       </Modal>
       
       {/* Priority Modal */}
       <Modal
         visible={showPriorityModal}
         transparent
         animationType="slide"
         onRequestClose={() => setShowPriorityModal(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Select Priority</Text>
               <TouchableOpacity onPress={() => setShowPriorityModal(false)}>
                 <Ionicons name="close" size={24} color="#666" />
               </TouchableOpacity>
             </View>
             <FlatList
               data={priorityLevels}
               keyExtractor={(item) => item.id}
               renderItem={({ item }) => (
                 <TouchableOpacity
                   style={[
                     styles.modalOption,
                     ticketForm.priority === item.id && styles.modalOptionSelected
                   ]}
                   onPress={() => {
                     updateTicketForm('priority', item.id);
                     setShowPriorityModal(false);
                   }}
                 >
                   <View style={[styles.priorityIndicator, { backgroundColor: item.color }]} />
                   <View style={styles.priorityInfo}>
                     <Text style={[
                       styles.modalOptionText,
                       ticketForm.priority === item.id && styles.modalOptionTextSelected
                     ]}>
                       {item.label}
                     </Text>
                     <Text style={styles.priorityDescription}>{item.description}</Text>
                   </View>
                   {ticketForm.priority === item.id && (
                     <Ionicons name="checkmark" size={20} color="#007bff" />
                   )}
                 </TouchableOpacity>
               )}
             />
           </View>
         </View>
       </Modal>

       {/* Ticket Detail Modal */}
       <Modal
         visible={showTicketDetailModal}
         animationType="slide"
         transparent={true}
         onRequestClose={() => setShowTicketDetailModal(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.ticketDetailModal}>
             <View style={styles.ticketDetailHeader}>
               <Text style={styles.ticketDetailTitle}>Ticket Details</Text>
               <TouchableOpacity onPress={() => setShowTicketDetailModal(false)}>
                 <Ionicons name="close" size={28} color="#2c3e50" />
               </TouchableOpacity>
             </View>
             
             {selectedTicket && (
               <ScrollView style={styles.ticketDetailContent}>
                 <View style={styles.ticketDetailSection}>
                   <Text style={styles.ticketDetailLabel}>Ticket ID</Text>
                   <View style={styles.ticketIdBadge}>
                     <Text style={styles.ticketIdBadgeText}>{selectedTicket.id}</Text>
                   </View>
                 </View>

                 <View style={styles.ticketDetailRow}>
                   <View style={styles.ticketDetailSection}>
                     <Text style={styles.ticketDetailLabel}>Status</Text>
                     <View style={[
                       styles.statusBadgeLarge,
                       { backgroundColor: getStatusColor(selectedTicket.status) }
                     ]}>
                       <Text style={styles.statusTextLarge}>
                         {selectedTicket.status.toUpperCase()}
                       </Text>
                     </View>
                   </View>

                   <View style={styles.ticketDetailSection}>
                     <Text style={styles.ticketDetailLabel}>Priority</Text>
                     <View style={[
                       styles.priorityBadgeLarge,
                       { backgroundColor: getPriorityColor(selectedTicket.priority) }
                     ]}>
                       <Text style={styles.priorityTextLarge}>
                         {selectedTicket.priority.toUpperCase()}
                       </Text>
                     </View>
                   </View>
                 </View>

                 <View style={styles.ticketDetailSection}>
                   <Text style={styles.ticketDetailLabel}>Category</Text>
                   <Text style={styles.ticketDetailValue}>
                     {getCategoryLabel(selectedTicket.category)}
                   </Text>
                 </View>

                 <View style={styles.ticketDetailSection}>
                   <Text style={styles.ticketDetailLabel}>Subject</Text>
                   <Text style={styles.ticketDetailValue}>
                     {selectedTicket.subject}
                   </Text>
                 </View>

                 <View style={styles.ticketDetailSection}>
                   <Text style={styles.ticketDetailLabel}>Description</Text>
                   <Text style={styles.ticketDetailDescription}>
                     {selectedTicket.description}
                   </Text>
                 </View>

                 {selectedTicket.attachment_url && (
                   <View style={styles.ticketDetailSection}>
                     <Text style={styles.ticketDetailLabel}>Attachment</Text>
                     <TouchableOpacity 
                       style={styles.attachmentLinkButton}
                       onPress={() => Linking.openURL(selectedTicket.attachment_url)}
                     >
                       <Ionicons name="document" size={20} color="#007bff" />
                       <Text style={styles.attachmentLinkButtonText}>
                         {selectedTicket.attachment_filename || 'View Attachment'}
                       </Text>
                       <Ionicons name="open-outline" size={16} color="#007bff" />
                     </TouchableOpacity>
                   </View>
                 )}

                 <View style={styles.ticketDetailSection}>
                   <Text style={styles.ticketDetailLabel}>Created</Text>
                   <Text style={styles.ticketDetailValue}>
                     {new Date(selectedTicket.created_at).toLocaleString()}
                   </Text>
                 </View>

                 {selectedTicket.updated_at !== selectedTicket.created_at && (
                   <View style={styles.ticketDetailSection}>
                     <Text style={styles.ticketDetailLabel}>Last Updated</Text>
                     <Text style={styles.ticketDetailValue}>
                       {new Date(selectedTicket.updated_at).toLocaleString()}
                     </Text>
                   </View>
                 )}

                 {selectedTicket.responses && selectedTicket.responses.length > 0 && (
                   <View style={styles.ticketDetailSection}>
                     <Text style={styles.ticketDetailLabel}>Responses</Text>
                     {selectedTicket.responses.map((response, index) => (
                       <View key={index} style={styles.responseCard}>
                         <View style={styles.responseHeader}>
                           <Text style={styles.responseName}>
                             {response.responder_name || 'Support Team'}
                           </Text>
                           <Text style={styles.responseDate}>
                             {formatTicketDate(response.created_at)}
                           </Text>
                         </View>
                         <Text style={styles.responseMessage}>
                           {response.message}
                         </Text>
                       </View>
                     ))}
                   </View>
                 )}
               </ScrollView>
             )}
           </View>
         </View>
       </Modal>
    </SafeAreaView>
  );
};

const createStyles = () => StyleSheet.create({
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3266a8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },

  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop:32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 12,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  contactOptions: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  contactOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactLabel: {
    fontSize: 14,
    color: '#666',
    width: 60,
  },
  contactValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 1,
  },
  
  // Support ticket form styles
  ticketForm: {
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectorText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  prioritySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  priorityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
    minHeight: 48,
  },
  textArea: {
    minHeight: 100,
    maxHeight: 150,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#3266a8',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  modalOptionSelected: {
    backgroundColor: '#f8f9fa',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
    flex: 1,
  },
  modalOptionTextSelected: {
    color: '#3266a8',
    fontWeight: '600',
  },
  priorityInfo: {
    flex: 1,
    marginLeft: 8,
  },
  priorityDescription: {
     fontSize: 12,
     color: '#666',
     marginTop: 2,
   },
   
   // Reply information styles
   replyInfoContainer: {
     backgroundColor: '#f8f9fa',
     borderRadius: 8,
     padding: 16,
     marginTop: 16,
     borderLeftWidth: 4,
     borderLeftColor: '#3266a8',
   },
   replyInfoHeader: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 8,
   },
   replyInfoTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#2c3e50',
     marginLeft: 8,
   },
   replyInfoText: {
     fontSize: 14,
     color: '#666',
     marginBottom: 12,
     lineHeight: 20,
   },
   replyMethodsList: {
     marginBottom: 12,
   },
   replyMethod: {
     flexDirection: 'row',
     alignItems: 'flex-start',
     marginBottom: 8,
   },
   replyMethodText: {
     fontSize: 14,
     color: '#666',
     marginLeft: 8,
     flex: 1,
     lineHeight: 18,
   },
   replyInfoNote: {
     fontSize: 13,
     color: '#666',
     fontStyle: 'italic',
     lineHeight: 18,
   },

   // Attachment styles
   attachmentButton: {
     borderWidth: 1,
     borderColor: '#3266a8',
     borderStyle: 'dashed',
     borderRadius: 8,
     paddingVertical: 16,
     paddingHorizontal: 12,
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: '#f8f9fa',
   },
   attachmentButtonText: {
     fontSize: 16,
     color: '#3266a8',
     fontWeight: '500',
     marginTop: 4,
   },
   attachmentHint: {
     fontSize: 12,
     color: '#666',
     marginTop: 2,
   },
   attachmentContainer: {
     borderWidth: 1,
     borderColor: '#e0e0e0',
     borderRadius: 8,
     backgroundColor: '#fff',
     overflow: 'hidden',
   },
   attachmentInfo: {
     flexDirection: 'row',
     alignItems: 'center',
     padding: 12,
   },
   attachmentDetails: {
     flex: 1,
     marginLeft: 12,
   },
   attachmentName: {
     fontSize: 14,
     fontWeight: '500',
     color: '#333',
     marginBottom: 2,
   },
   attachmentSize: {
     fontSize: 12,
     color: '#666',
   },
   removeAttachmentButton: {
     padding: 4,
   },
   
   // My Tickets Section Styles
   sectionHeaderRow: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginBottom: 16,
   },
   ticketsLoadingContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     padding: 20,
   },
   ticketsLoadingText: {
     marginLeft: 10,
     color: '#666',
     fontSize: 14,
   },
   noTicketsContainer: {
     alignItems: 'center',
     padding: 40,
     backgroundColor: '#f8f9fa',
     borderRadius: 12,
   },
   noTicketsText: {
     fontSize: 16,
     fontWeight: '600',
     color: '#666',
     marginTop: 12,
   },
   noTicketsSubtext: {
     fontSize: 14,
     color: '#999',
     marginTop: 4,
     textAlign: 'center',
   },
   ticketsContainer: {
     gap: 12,
   },
   ticketCard: {
     backgroundColor: '#fff',
     borderRadius: 12,
     padding: 16,
     borderWidth: 1,
     borderColor: '#e0e0e0',
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.05,
     shadowRadius: 4,
     elevation: 2,
   },
   ticketCardHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginBottom: 12,
   },
   ticketIdContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 6,
   },
   ticketId: {
     fontSize: 12,
     color: '#666',
     fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
   },
   statusBadge: {
     paddingHorizontal: 10,
     paddingVertical: 4,
     borderRadius: 12,
   },
   statusText: {
     color: '#fff',
     fontSize: 11,
     fontWeight: '700',
   },
   ticketSubject: {
     fontSize: 16,
     fontWeight: '600',
     color: '#2c3e50',
     marginBottom: 8,
   },
   ticketDescription: {
     fontSize: 14,
     color: '#666',
     lineHeight: 20,
     marginBottom: 12,
   },
   ticketCardFooter: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginTop: 8,
     paddingTop: 12,
     borderTopWidth: 1,
     borderTopColor: '#f0f0f0',
   },
   ticketMeta: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 8,
     flex: 1,
   },
   priorityBadge: {
     paddingHorizontal: 8,
     paddingVertical: 3,
     borderRadius: 8,
   },
   priorityText: {
     color: '#fff',
     fontSize: 10,
     fontWeight: '600',
   },
   ticketCategory: {
     fontSize: 12,
     color: '#888',
   },
   ticketDate: {
     fontSize: 12,
     color: '#999',
   },
   attachmentIndicator: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 4,
     marginTop: 8,
     paddingTop: 8,
     borderTopWidth: 1,
     borderTopColor: '#f0f0f0',
   },
   attachmentText: {
     fontSize: 12,
     color: '#666',
   },
   
   // Ticket Detail Modal Styles
   modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'center',
     alignItems: 'center',
   },
   ticketDetailModal: {
     backgroundColor: '#fff',
     borderRadius: 16,
     width: '90%',
     maxHeight: '80%',
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 8,
     elevation: 8,
   },
   ticketDetailHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     padding: 20,
     borderBottomWidth: 1,
     borderBottomColor: '#e0e0e0',
   },
   ticketDetailTitle: {
     fontSize: 20,
     fontWeight: '700',
     color: '#2c3e50',
   },
   ticketDetailContent: {
     padding: 20,
   },
   ticketDetailSection: {
     marginBottom: 20,
   },
   ticketDetailRow: {
     flexDirection: 'row',
     gap: 16,
     marginBottom: 20,
   },
   ticketDetailLabel: {
     fontSize: 12,
     fontWeight: '600',
     color: '#888',
     textTransform: 'uppercase',
     letterSpacing: 0.5,
     marginBottom: 8,
   },
   ticketDetailValue: {
     fontSize: 15,
     color: '#2c3e50',
     lineHeight: 22,
   },
   ticketDetailDescription: {
     fontSize: 15,
     color: '#444',
     lineHeight: 24,
   },
   ticketIdBadge: {
     backgroundColor: '#f8f9fa',
     paddingHorizontal: 12,
     paddingVertical: 8,
     borderRadius: 8,
     alignSelf: 'flex-start',
   },
   ticketIdBadgeText: {
     fontSize: 13,
     fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
     color: '#2c3e50',
     fontWeight: '600',
   },
   statusBadgeLarge: {
     paddingHorizontal: 16,
     paddingVertical: 8,
     borderRadius: 8,
     alignSelf: 'flex-start',
   },
   statusTextLarge: {
     color: '#fff',
     fontSize: 13,
     fontWeight: '700',
   },
   priorityBadgeLarge: {
     paddingHorizontal: 16,
     paddingVertical: 8,
     borderRadius: 8,
     alignSelf: 'flex-start',
   },
   priorityTextLarge: {
     color: '#fff',
     fontSize: 13,
     fontWeight: '700',
   },
   attachmentLinkButton: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 8,
     padding: 12,
     backgroundColor: '#f0f7ff',
     borderRadius: 8,
     borderWidth: 1,
     borderColor: '#007bff',
   },
   attachmentLinkButtonText: {
     flex: 1,
     fontSize: 14,
     color: '#007bff',
     fontWeight: '500',
   },
   responseCard: {
     backgroundColor: '#f8f9fa',
     padding: 12,
     borderRadius: 8,
     marginBottom: 12,
     borderLeftWidth: 3,
     borderLeftColor: '#007bff',
   },
   responseHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     marginBottom: 8,
   },
   responseName: {
     fontSize: 13,
     fontWeight: '600',
     color: '#2c3e50',
   },
   responseDate: {
     fontSize: 11,
     color: '#888',
   },
   responseMessage: {
     fontSize: 14,
     color: '#444',
     lineHeight: 20,
   },

});

export default HelpSupportScreen;
