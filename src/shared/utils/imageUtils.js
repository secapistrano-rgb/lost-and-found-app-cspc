import { Platform } from 'react-native';
// Note: This utility file cannot directly use React hooks, so Alert.alert calls
// should be handled by the calling components using ProfessionalAlert
import * as ImagePicker from 'expo-image-picker';

// Helper function for image recognition (used by both camera and library)

// Take a photo using the camera
export const takePhoto = async (uploadFolder = 'general') => {
  try {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.error('Camera permission is needed to take photos');
      return null;
    }
    
    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      // Image picker configuration for URL-based handling
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // Return the local URI - upload will be handled by ImagePickerComponent
      return asset.uri;
    }
    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    console.error('Failed to take photo. Please try again.');
    return null;
  }
};

// Pick an image from the media library
export const pickImage = async (uploadFolder = 'general') => {
  try {
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.error('Media library permission is needed to select photos');
      return null;
    }
    
    // Launch image library
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
      // Image picker configuration for URL-based handling
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // Return the local URI - upload will be handled by ImagePickerComponent
      return asset.uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    console.error('Failed to pick image. Please try again.');
    return null;
  }
};

// Note: Image recognition is now handled by Clarifai API in clarifaiAPI.js
// This file now contains image picker utilities for URL-based image handling