import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';

import { getUser } from '../../../shared/storage/storage';
import { getFeedbackByUser, createFeedback, updateFeedback, deleteFeedback, getFeedbackResponses, createFeedbackResponse } from '../../../config/apiConfig';
import ProfessionalAlert from '../../../components/common/modals/ProfessionalAlert';
import useProfessionalAlert from '../../../shared/hooks/useProfessionalAlert';
import { formatPhilippineDate } from '../../../shared/utils/dateUtils';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';
import { requireInternet } from '../../../shared/utils/internetRequired';

const UserFeedbackScreen = ({ navigation, route }) => {
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pastFeedback, setPastFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [editType, setEditType] = useState('suggestion');
  const [replyingToFeedback, setReplyingToFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [highlightFeedbackId, setHighlightFeedbackId] = useState(null);
  const scrollViewRef = React.useRef(null);
  // Attachment states
  const [attachment, setAttachment] = useState(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  
  const styles = createStyles();
  const { alertConfig, showError, showSuccess, hideAlert } = useProfessionalAlert();

  useEffect(() => {
    loadUserData();
  }, []);

  // Handle highlighted feedback from notification
  useEffect(() => {
    if (route.params?.highlightFeedbackId) {
      setHighlightFeedbackId(route.params.highlightFeedbackId);
      // Clear the highlight after 3 seconds
      setTimeout(() => {
        setHighlightFeedbackId(null);
      }, 3000);
    }
  }, [route.params?.highlightFeedbackId]);

  // Auto-refresh feedback every 1 second without blinking
  useEffect(() => {
    let refreshInterval;
    
    if (userData && userData.email) {
      refreshInterval = setInterval(async () => {
        try {
          // Get fresh feedback data
          const response = await getFeedbackByUser(userData.email);
          const newFeedback = response?.data || [];
          const feedbackArray = Array.isArray(newFeedback) ? newFeedback : [];
          
          // Only update state if data has actually changed
          setPastFeedback(prevFeedback => {
            const prevString = JSON.stringify(prevFeedback);
            const newString = JSON.stringify(feedbackArray);
            
            // Only update if there's a real change
            if (prevString !== newString) {
              return feedbackArray;
            }
            return prevFeedback;
          });
        } catch (error) {
          console.error('Auto-refresh error:', error);
        }
      }, 1000); // Refresh every 1 second
    }
    
    // Cleanup interval on unmount or when userData changes
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [userData]);
  
  const loadUserData = async () => {
    try {
      const user = await getUser();
      if (user) {
        // Ensure we have the photoURL from the Gmail user profile
        const userData = {
          ...user,
          // Use profileImage field if it exists (from Gmail login) or fallback to photoURL
          photoURL: user.profileImage || user.photoURL || null
        };
        console.log('User data with photo URL:', userData);
        setUserData(userData);
        loadPastFeedback(userData.email);
      } else {
        // If no user data found, show alert and go back
        showError(
          'Not Signed In',
          'You need to be signed in to submit feedback.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const handleReplyToFeedback = (feedback) => {
    setReplyingToFeedback(feedback);
    setReplyText('');
  };

  const handleSubmitReply = async () => {
    if (!replyingToFeedback || !userData) return;
    
    if (replyText.trim().length < 5) {
      showError(
        'Reply Too Short',
        'Please provide more details in your reply (at least 5 characters).'
      );
      return;
    }

    setSubmittingReply(true);
    try {
      const replyData = {
        id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        admin_email: userData.email,
        admin_name: userData.name || userData.email,
        response_text: replyText
      };

      await createFeedbackResponse(replyingToFeedback.id, replyData);
      
      // Reload feedback list to show the new reply
      await loadPastFeedback(userData.email);
      
      // Reset reply state
      setReplyingToFeedback(null);
      setReplyText('');
      
      showSuccess(
        'Reply Sent!',
        'Your reply has been submitted successfully.'
      );
    } catch (error) {
      console.error('Error submitting reply:', error);
      showError(
        'Error',
        `Failed to submit reply: ${error.message || 'Unknown error'}`
      );
    } finally {
      setSubmittingReply(false);
    }
  };

  const loadPastFeedback = async (email) => {
    if (!email) return;
    
    setLoading(true);
    try {
      // Use API to get feedback by user email
      const response = await getFeedbackByUser(email);
      const feedback = response?.data || [];
      setPastFeedback(Array.isArray(feedback) ? feedback : []);
    } catch (error) {
      console.error('Error loading past feedback:', error);
      // Set to empty array on error
      setPastFeedback([]);
    } finally {
      setLoading(false);
    }
  };

  const saveFeedback = async (newFeedback) => {
    if (!userData || !userData.email) {
      showError('Error', 'User information not available. Please sign in again.');
      return false;
    }
    
    try {
      // Use API to create feedback
      const response = await createFeedback(newFeedback);
      console.log('Feedback creation response:', response);
      
      // If we get here without an error, the feedback was created successfully
      // Reload feedback list after successful creation
      await loadPastFeedback(userData.email);
      return true;
    } catch (error) {
      console.error('Error saving feedback:', error);
      console.error('Error details:', error.message);
      
      // Show more specific error message to user
      showError(
        'Error',
        `Failed to create feedback: ${error.message || 'Unknown error'}`
      );
      return false;
    }
  };

  const handleEditFeedback = (feedback) => {
    setEditingFeedback(feedback);
    setEditText(feedback.text);
    setEditRating(feedback.rating || 0);
    setEditType(feedback.type);
  };

  const handleUpdateFeedback = async () => {
    if (!editingFeedback) return;
    
    if (editText.trim().length < 10) {
      showError(
        'Feedback Too Short',
        'Please provide more details in your feedback (at least 10 characters).'
      );
      return;
    }

    if (editType === 'rating' && editRating === 0) {
      showError(
        'Rating Required',
        'Please select a rating for your feedback.'
      );
      return;
    }

    try {
      const updatedFeedback = {
        user_email: editingFeedback.user_email,
        type: editType,
        rating: editType === 'rating' ? editRating : null,
        text: editText,
        status: editingFeedback.status,
        user_name: editingFeedback.user_name,
        user_photo_url: editingFeedback.user_photo_url,
        user_profile_image: editingFeedback.user_profile_image
      };

      await updateFeedback(editingFeedback.id, updatedFeedback);
      
      // Reload feedback list
      await loadPastFeedback(userData.email);
      
      // Reset editing state
      setEditingFeedback(null);
      setEditText('');
      setEditRating(0);
      setEditType('suggestion');
      
      showSuccess(
        'Updated!',
        'Your feedback has been updated successfully.'
      );
    } catch (error) {
      console.error('Error updating feedback:', error);
      showError(
        'Error',
        `Failed to update feedback: ${error.message || 'Unknown error'}`
      );
    }
  };

  const handleDeleteFeedback = (feedback) => {
    showError(
      'Delete Feedback',
      'Are you sure you want to delete this feedback? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeedback(feedback.id);
              await loadPastFeedback(userData.email);
              showSuccess(
                'Deleted!',
                'Your feedback has been deleted successfully.'
              );
            } catch (error) {
              console.error('Error deleting feedback:', error);
              showError(
                'Error',
                `Failed to delete feedback: ${error.message || 'Unknown error'}`
              );
            }
          }
        }
      ]
    );
  };

  const cancelEdit = () => {
    setEditingFeedback(null);
    setEditText('');
    setEditRating(0);
    setEditType('suggestion');
  };

  const handleSubmit = async () => {
    // Validate input
    if (feedbackText.trim().length < 10) {
      showError(
        'Feedback Too Short',
        'Please provide more details in your feedback (at least 10 characters).'
      );
      return;
    }

    if (feedbackType === 'rating' && rating === 0) {
      showError(
        'Rating Required',
        'Please select a rating for your feedback.'
      );
      return;
    }

    setSubmitting(true);

    // Create feedback object with user information for API
    const newFeedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: feedbackType,
      rating: feedbackType === 'rating' ? rating : null,
      text: feedbackText,
      status: 'pending', // pending, reviewed, addressed
      user_email: userData?.email || '',
      user_name: userData?.displayName || userData?.name || 'Anonymous',
      user_photo_url: userData?.photoURL || userData?.profileImage || null,
    };

    // Save feedback
    const success = await saveFeedback(newFeedback);

    setSubmitting(false);

    if (success) {
      showSuccess(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your input!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setFeedbackType('suggestion');
              setRating(0);
              setFeedbackText('');
            },
          },
        ]
      );
    }
    // Error handling is now done in saveFeedback function
  };

  const renderRatingSelector = () => (
    <View style={styles.ratingContainer}>
      <Text style={styles.ratingLabel}>Your Rating:</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={rating >= star ? 'star' : 'star-outline'}
              size={32}
              color={rating >= star ? '#ffc107' : '#e0e0e0'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPastFeedback = () => {
    // Ensure pastFeedback is an array before checking length
    if (!pastFeedback || !Array.isArray(pastFeedback) || pastFeedback.length === 0) {
      return (
        <View style={styles.emptyFeedbackContainer}>
          <Ionicons name="chatbox-outline" size={48} color="#e0e0e0" />
          <Text style={styles.emptyFeedbackText}>
            You haven't submitted any feedback yet.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.pastFeedbackContainer}>
        <Text style={styles.pastFeedbackTitle}>Your Previous Feedback</Text>
        {Array.isArray(pastFeedback) && pastFeedback.map((feedback) => (
          <View 
            key={feedback.id} 
            style={[
              styles.feedbackItem,
              highlightFeedbackId === feedback.id && styles.highlightedFeedback
            ]}
          >
            <View style={styles.feedbackHeader}>
              <View style={styles.feedbackTypeContainer}>
                <Ionicons
                  name={
                    feedback.type === 'bug'
                      ? 'bug'
                      : feedback.type === 'rating'
                      ? 'star'
                      : 'bulb'
                  }
                  size={16}
                  color="#fff"
                />
                <Text style={styles.feedbackTypeText}>
                  {feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1)}
                </Text>
              </View>
              <Text style={styles.feedbackDate}>
                {formatPhilippineDate(feedback.created_at)}
              </Text>
            </View>

            {feedback.user_name && (
              <View style={styles.feedbackUserInfo}>
                {feedback.user_photo_url ? (
                  <Image 
                    source={{ uri: feedback.user_photo_url }} 
                    style={styles.feedbackUserAvatar} 
                    onError={(e) => {
                      console.log('Error loading feedback user image:', e.nativeEvent.error);
                    }}
                  />
                ) : (
                  <View style={styles.feedbackUserInitials}>
                    <Text style={styles.initialsText}>{feedback.user_name.charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.feedbackUserName}>{feedback.user_name}</Text>
              </View>
            )}

            {feedback.type === 'rating' && (
              <View style={styles.feedbackRating}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={feedback.rating >= star ? 'star' : 'star-outline'}
                    size={16}
                    color={feedback.rating >= star ? '#ffc107' : '#e0e0e0'}
                  />
                ))}
              </View>
            )}
            
            <Text style={styles.feedbackText}>{feedback.text}</Text>
            
            {/* Admin Responses */}
            {feedback.responses && feedback.responses.length > 0 && (
              <View style={styles.responsesContainer}>
                <Text style={styles.responsesTitle}>Admin Responses:</Text>
                {feedback.responses.map((response) => (
                  <View key={response.id} style={styles.responseItem}>
                    <View style={styles.responseHeader}>
                      <Text style={styles.responseAdminName}>{response.admin_name}</Text>
                      <Text style={styles.responseDate}>
                        {formatPhilippineDate(response.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.responseText}>{response.response_text}</Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.feedbackStatus}>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor:
                      feedback.status === 'addressed'
                        ? '#28a745'
                        : feedback.status === 'reviewed'
                        ? '#ffc107'
                        : '#f0f0f0',
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {feedback.status.charAt(0).toUpperCase() + feedback.status.slice(1)}
              </Text>
            </View>
            
            <View style={styles.feedbackActions}>
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => handleReplyToFeedback(feedback)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#3266a8" />
                <Text style={styles.actionButtonText}>Reply</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditFeedback(feedback)}
              >
                <Ionicons name="pencil" size={16} color="#3266a8" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteFeedback(feedback)}
              >
                <Ionicons name="trash" size={16} color="#dc3545" />
                <Text style={[styles.actionButtonText, { color: '#dc3545' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Feedback</Text>
          <View style={{ width: 32 }} />
        </View>
        
        {userData && (
          <View style={styles.userInfoContainer}>
            {userData.photoURL ? (
              <Image 
                source={{ uri: userData.photoURL }} 
                style={styles.userAvatar} 
                onError={(e) => console.log('Error loading profile image:', e.nativeEvent.error)}
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>We Value Your Feedback</Text>
            <Text style={styles.formSubtitle}>
              Help us improve the Lost and Found app by sharing your thoughts.
            </Text>

            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  feedbackType === 'suggestion' && styles.activeTypeButton,
                ]}
                onPress={() => setFeedbackType('suggestion')}
              >
                <Ionicons
                  name="bulb-outline"
                  size={20}
                  color={
                    feedbackType === 'suggestion'
                      ? '#fff'
                      : '#666'
                  }
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    feedbackType === 'suggestion' && styles.activeTypeButtonText,
                  ]}
                >
                  Suggestion
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  feedbackType === 'bug' && styles.activeTypeButton,
                ]}
                onPress={() => setFeedbackType('bug')}
              >
                <Ionicons
                  name="bug-outline"
                  size={20}
                  color={
                    feedbackType === 'bug'
                      ? '#fff'
                      : '#666'
                  }
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    feedbackType === 'bug' && styles.activeTypeButtonText,
                  ]}
                >
                  Report Bug
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  feedbackType === 'rating' && styles.activeTypeButton,
                ]}
                onPress={() => setFeedbackType('rating')}
              >
                <Ionicons
                  name="star-outline"
                  size={20}
                  color={
                    feedbackType === 'rating'
                      ? '#fff'
                      : '#666'
                  }
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    feedbackType === 'rating' && styles.activeTypeButtonText,
                  ]}
                >
                  Rate App
                </Text>
              </TouchableOpacity>
            </View>

            {feedbackType === 'rating' && renderRatingSelector()}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {feedbackType === 'suggestion'
                  ? 'Your Suggestion:'
                  : feedbackType === 'bug'
                  ? 'Describe the Bug:'
                  : 'Additional Comments:'}
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                placeholder={
                  feedbackType === 'suggestion'
                    ? 'Share your ideas on how we can improve...'
                    : feedbackType === 'bug'
                    ? 'What went wrong? Please provide steps to reproduce...'
                    : 'Tell us more about your experience...'
                }
                value={feedbackText}
                onChangeText={setFeedbackText}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {editingFeedback && (
            <View style={styles.editFormContainer}>
              <View style={styles.editFormHeader}>
                <Text style={styles.editFormTitle}>Edit Feedback</Text>
                <TouchableOpacity onPress={cancelEdit} style={styles.cancelEditButton}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editType === 'suggestion' && styles.activeTypeButton,
                  ]}
                  onPress={() => setEditType('suggestion')}
                >
                  <Ionicons
                    name="bulb-outline"
                    size={20}
                    color={
                      editType === 'suggestion'
                        ? '#fff'
                        : '#666'
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      editType === 'suggestion' && styles.activeTypeButtonText,
                    ]}
                  >
                    Suggestion
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editType === 'bug' && styles.activeTypeButton,
                  ]}
                  onPress={() => setEditType('bug')}
                >
                  <Ionicons
                    name="bug-outline"
                    size={20}
                    color={
                      editType === 'bug'
                        ? '#fff'
                        : '#666'
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      editType === 'bug' && styles.activeTypeButtonText,
                    ]}
                  >
                    Report Bug
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    editType === 'rating' && styles.activeTypeButton,
                  ]}
                  onPress={() => setEditType('rating')}
                >
                  <Ionicons
                    name="star-outline"
                    size={20}
                    color={
                      editType === 'rating'
                        ? '#fff'
                        : '#666'
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      editType === 'rating' && styles.activeTypeButtonText,
                    ]}
                  >
                    Rate App
                  </Text>
                </TouchableOpacity>
              </View>

              {editType === 'rating' && (
                <View style={styles.ratingContainer}>
                  <Text style={styles.ratingLabel}>Your Rating:</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setEditRating(star)}
                        style={styles.starButton}
                      >
                        <Ionicons
                          name={editRating >= star ? 'star' : 'star-outline'}
                          size={32}
                          color={editRating >= star ? '#ffc107' : '#e0e0e0'}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  {editType === 'suggestion'
                    ? 'Your Suggestion:'
                    : editType === 'bug'
                    ? 'Describe the Bug:'
                    : 'Additional Comments:'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  multiline
                  numberOfLines={5}
                  placeholder={
                    editType === 'suggestion'
                      ? 'Share your ideas on how we can improve...'
                      : editType === 'bug'
                      ? 'What went wrong? Please provide steps to reproduce...'
                      : 'Tell us more about your experience...'
                  }
                  value={editText}
                  onChangeText={setEditText}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.editFormActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={cancelEdit}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={handleUpdateFeedback}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.updateButtonText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {replyingToFeedback && (
            <View style={styles.replyFormContainer}>
              <View style={styles.replyFormHeader}>
                <Text style={styles.replyFormTitle}>Reply to Feedback</Text>
                <TouchableOpacity
                  style={styles.cancelEditButton}
                  onPress={() => {
                    setReplyingToFeedback(null);
                    setReplyText('');
                  }}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.originalFeedbackContainer}>
                <Text style={styles.originalFeedbackLabel}>Original Feedback:</Text>
                <Text style={styles.originalFeedbackText}>{replyingToFeedback.text}</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Your Reply:</Text>
                <TextInput
                  style={styles.textInput}
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Enter your reply..."
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.replyFormActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setReplyingToFeedback(null);
                    setReplyText('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.updateButton, submittingReply && styles.disabledButton]}
                  onPress={handleSubmitReply}
                  disabled={submittingReply}
                >
                  {submittingReply ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                  <Text style={styles.updateButtonText}>
                    {submittingReply ? 'Sending...' : 'Send Reply'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3266a8" />
              <Text style={styles.loadingText}>Loading your feedback...</Text>
            </View>
          ) : (
            renderPastFeedback()
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      
      <ProfessionalAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={hideAlert}
      />
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
    borderBottomColor: '#f0f0f0',
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
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
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  activeTypeButton: {
    backgroundColor: '#3266a8',
    borderColor: '#3266a8',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  activeTypeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  ratingContainer: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starButton: {
    padding: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2c3e50',
    backgroundColor: '#fff',
    minHeight: 120,
    maxHeight: 500,
  },
  submitButton: {
    backgroundColor: '#3266a8',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  pastFeedbackContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pastFeedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  emptyFeedbackContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyFeedbackText: {
    marginTop: 16,
    color: '#666',
    textAlign: 'center',
  },
  feedbackItem: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  highlightedFeedback: {
    borderColor: '#27ae60',
    borderWidth: 2,
    backgroundColor: '#e8f5e9',
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3266a8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  feedbackTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  feedbackDate: {
    fontSize: 12,
    color: '#999',
  },
  feedbackUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  feedbackUserAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  feedbackUserInitials: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  initialsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedbackUserName: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '500',
  },
  feedbackRating: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 20,
  },
  feedbackStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  feedbackActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  actionButtonText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#3266a8',
  },
  editFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#3266a8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3266a8',
  },
  cancelEditButton: {
    padding: 4,
  },
  editFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#3266a8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  responsesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  responsesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  responseItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  responseAdminName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3266a8',
  },
  responseDate: {
    fontSize: 10,
    color: '#999',
  },
  responseText: {
    fontSize: 12,
    color: '#2c3e50',
    lineHeight: 16,
  },
  replyFormContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#28a745',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  replyFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  replyFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  originalFeedbackContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  originalFeedbackLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  originalFeedbackText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 18,
  },
  replyFormActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

// Wrap UserFeedbackScreen with internet guard to block access when offline
export default withInternetGuard(UserFeedbackScreen);
