import * as Location from 'expo-location';

/**
 * Request location permissions from the user
 * @returns {Promise<boolean>} Whether permission was granted
 */
export const requestLocationPermission = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
};

/**
 * Get the current location of the device
 * @returns {Promise<Object|null>} Location object or null if unavailable
 */
export const getCurrentLocation = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      console.error('Location permission denied: This feature requires location permission to tag where the item was found or lost.');
      return null;
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeout: 15000,
      maximumAge: 10000,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

/**
 * Format coordinates for display
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @returns {string} Formatted coordinates string
 */
export const formatCoordinates = (latitude, longitude) => {
  if (latitude === undefined || longitude === undefined) {
    return 'Unknown location';
  }
  
  // Convert decimal degrees to degrees, minutes, seconds
  const formatDMS = (coordinate, isLatitude) => {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    
    const direction = isLatitude
      ? coordinate >= 0 ? 'N' : 'S'
      : coordinate >= 0 ? 'E' : 'W';
    
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };
  
  const latDMS = formatDMS(latitude, true);
  const lngDMS = formatDMS(longitude, false);
  
  return `${latDMS} ${lngDMS}`;
};

/**
 * Get a readable address from coordinates using reverse geocoding
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @returns {Promise<string>} Human-readable address
 */
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    if (latitude === undefined || longitude === undefined) {
      return 'Unknown location';
    }
    
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude
    });
    
    if (results && results.length > 0) {
      const { street, name, city, region, country } = results[0];
      
      // Construct address string from available components
      const addressParts = [];
      if (street) addressParts.push(street);
      else if (name) addressParts.push(name);
      
      if (city) addressParts.push(city);
      if (region) addressParts.push(region);
      if (country) addressParts.push(country);
      
      return addressParts.join(', ');
    }
    
    return formatCoordinates(latitude, longitude);
  } catch (error) {
    console.error('Error getting address from coordinates:', error);
    return formatCoordinates(latitude, longitude);
  }
};