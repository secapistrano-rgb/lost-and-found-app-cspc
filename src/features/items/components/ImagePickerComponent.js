import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { takePhoto, pickImage } from '../../../shared/utils/imageUtils';
import { analyzeImageWithGemini } from '../../../shared/api/GeminiAPI';
import { analyzeImageForContent, validateImageFormat } from '../../../shared/services/imageFilteringService';
import { uploadImage } from '../../../shared/services/imageUploadService';

const ImagePickerComponent = ({ onImageSelected, onCategoriesDetected, onObjectsDetected, onDescriptionGenerated }) => {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  const handleTakePhoto = async () => {
    const uri = await takePhoto();
    if (uri) {
      processImage(uri);
    }
  };

  const handlePickImage = async () => {
    const uri = await pickImage();
    if (uri) {
      processImage(uri);
    }
  };

  const processImage = async (uri) => {
    console.log('=== PROCESSING NEW IMAGE ===');
    console.log('New image URI:', uri);
    console.log('Previous image URI:', imageUri);
    console.log('Processing timestamp:', new Date().toISOString());
    
    // Reset state to ensure clean processing
    setImageUri(null);
    setLoading(true);
    setLoadingStep('Preparing image...');
    
    // Add a small delay to ensure the loading state is visible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // Check if the URI is already an uploaded URL (starts with http)
      let finalImageUrl = uri;
      let contentAnalysis = null;
      
      if (!uri.startsWith('http')) {
        // First, validate image format for local files
        const formatValidation = validateImageFormat(uri);
        if (!formatValidation.isValid) {
          Alert.alert('Invalid Image', formatValidation.reason);
          setLoading(false);
          setLoadingStep('');
          return;
        }

        // Upload the image first to get a server URL
        setLoadingStep('Uploading image...');
        await new Promise(resolve => setTimeout(resolve, 200)); // Ensure visibility
        const uploadResult = await uploadImage(uri);
        if (!uploadResult.success) {
          Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
          setLoading(false);
          setLoadingStep('');
          return;
        }
        
        finalImageUrl = uploadResult.imageUrl;
      }
      
      // ALWAYS check for inappropriate content, regardless of whether image was just uploaded or already exists
      setLoadingStep('Checking image content...');
      await new Promise(resolve => setTimeout(resolve, 200)); // Ensure visibility
      console.log('=== STARTING CONTENT ANALYSIS ===');
      console.log('Analyzing image URL:', finalImageUrl);
      contentAnalysis = await analyzeImageForContent(finalImageUrl);
      console.log('Content analysis result:', contentAnalysis);
      
      if (!contentAnalysis.isAppropriate) {
        console.log('Image rejected as inappropriate:', contentAnalysis.reason);
        Alert.alert(
          '⚠️ Image Cannot Be Used',
          `${contentAnalysis.reason}\n\n📸 What to do next:\n\n• Take a new photo showing only the item\n• Ensure good lighting and clear focus\n• Avoid including people, faces, or sensitive information\n• Use appropriate images suitable for campus community\n\nPlease try again with a different image.`,
          [{ text: 'Got It', style: 'default' }]
        );
        // NOTE: The image is already uploaded. We might want to delete it here.
        // For now, we'll leave it, but this is a potential improvement.
        setLoading(false);
        setLoadingStep('');
        return;
      }
      
      console.log('Image approved as appropriate:', contentAnalysis.reason);
      
      // If content is appropriate, proceed with image processing
      // Don't set imageUri yet - keep showing loading
      // Pass the final image URL to the parent component
      onImageSelected(finalImageUrl);
      
      // Use Gemini API to analyze the image for item details, using the final URL
      setLoadingStep('Verifying objects and analyzing image...');
      const result = await analyzeImageWithGemini(finalImageUrl);
      
      // Pass the detected data to the parent component
      if (result.success) {
        setLoadingStep('Processing detected objects...');
        
        if (onCategoriesDetected && result.categories) {
          onCategoriesDetected(result.categories);
        }
        
        if (onObjectsDetected && result.objects) {
          onObjectsDetected(result.objects);
        }
        
        if (onDescriptionGenerated && result.description) {
          onDescriptionGenerated(result.description);
        }
        
        // Log the analysis results for debugging (only if content analysis was performed)
        if (contentAnalysis) {
          console.log(`Content analysis - Type: ${contentAnalysis.contentType}, Confidence: ${contentAnalysis.confidence}`);
        }
        console.log(`Gemini analysis confidence: ${result.confidence}`);
        console.log('Detected objects:', result.objects);
        console.log('Generated description:', result.description);
        
        // Brief delay to show the completion message
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now set the image URI to display the image
        setImageUri(finalImageUrl);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      
      // Show user-friendly error message
      Alert.alert(
        'Image Processing Error',
        'Unable to process the image. Please try again with a different image.',
        [{ text: 'OK', style: 'default' }]
      );
      
      // Show fallback data if there's an error
      if (onCategoriesDetected) {
        onCategoriesDetected(['Other']);
      }
      if (onDescriptionGenerated) {
        onDescriptionGenerated('Item detected in image');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <View style={styles.container}>
      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            onError={(error) => console.log('Image load error:', error)}
          />
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={() => {
              // You can implement a modal or full screen view here if needed
              console.log('Image expand pressed');
            }}
          >
            <Ionicons name="expand" size={20} color="#fff" />
          </TouchableOpacity>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#3498db" />
              <Text style={styles.loadingText}>
                {loadingStep || 'Processing image...'}
              </Text>
            </View>
          )}
          <View style={styles.changeButtonContainer}>
            <TouchableOpacity 
              style={styles.changeButton} 
              onPress={handleTakePhoto}
              disabled={loading}
            >
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.changeButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.changeButton} 
              onPress={handlePickImage}
              disabled={loading}
            >
              <Ionicons name="image" size={16} color="#fff" />
              <Text style={styles.changeButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color="#3498db" />
              <Text style={styles.loadingPlaceholderText}>
                {loadingStep || 'Processing image...'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.placeholderText}>Add an image of the item</Text>
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={handleTakePhoto}>
                  <Ionicons name="camera" size={24} color="#3498db" />
                  <Text style={styles.buttonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handlePickImage}>
                  <Ionicons name="image" size={24} color="#3498db" />
                  <Text style={styles.buttonText}>Pick Image</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  placeholderContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
  },
  loadingPlaceholderText: {
    fontSize: 16,
    color: '#3498db',
    marginTop: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  button: {
    alignItems: 'center',
    padding: 10,
  },
  buttonText: {
    marginTop: 5,
    color: '#3498db',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  changeButtonContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  changeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  expandButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 20,
  },
});

export default ImagePickerComponent;
