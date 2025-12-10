import React from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const MapViewComponent = ({ 
  latitude, 
  longitude, 
  title = 'Location', 
  description = '', 
  height = 200,
  showMarker = true 
}) => {
  if (!latitude || !longitude) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={32} color="#ccc" />
          <Text style={styles.errorText}>Location not available</Text>
        </View>
      </View>
    );
  }

  const region = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    latitudeDelta: 0.005, // Zoom level
    longitudeDelta: 0.005,
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {showMarker && (
          <Marker
            coordinate={{
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
            }}
            title={title}
            description={description}
          >
            <View style={styles.markerContainer}>
              <Ionicons name="location" size={24} color="#e74c3c" />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default MapViewComponent;