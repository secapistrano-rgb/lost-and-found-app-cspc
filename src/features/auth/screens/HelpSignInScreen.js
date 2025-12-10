import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ImageBackground, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { withInternetGuard } from '../../../shared/hoc/withInternetGuard';

const HelpSignInScreen = ({ navigation }) => {
  return (
    <ImageBackground
      source={require('../../../../assets/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="help-circle-outline" size={72} color="#3266a8" style={styles.icon} />
          </View>
          <Text style={styles.title}>Need Help Signing In?</Text>
          <Text style={styles.subtitle}>We're here to help you access your account</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Common Sign-in Issues:</Text>
            <View style={styles.bulletPoint}>
              <Ionicons name="checkmark-circle" size={20} color="#3266a8" />
              <Text style={styles.bulletText}>Make sure you are using your official <Text style={styles.bold}>my.cspc.edu.ph</Text> Google account</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="wifi" size={20} color="#3266a8" />
              <Text style={styles.bulletText}>Check your internet connection</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="key" size={20} color="#3266a8" />
              <Text style={styles.bulletText}>If you forgot your password, use the Google account recovery options</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="warning" size={20} color="#e74c3c" />
              <Text style={styles.bulletText}>If your account is <Text style={styles.suspended}>suspended</Text>, you'll see a suspension message with details</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="people" size={20} color="#3266a8" />
              <Text style={styles.bulletText}>For further assistance, contact our support team</Text>
            </View>
          </View>
          
          <View style={styles.suspensionCard}>
            <Text style={styles.suspensionTitle}>Account Suspended?</Text>
            <View style={styles.bulletPoint}>
              <Ionicons name="information-circle" size={20} color="#e74c3c" />
              <Text style={styles.bulletText}>Check the suspension message for the reason and duration</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="time" size={20} color="#e74c3c" />
              <Text style={styles.bulletText}>Note the suspension end date if provided</Text>
            </View>
            <View style={styles.bulletPoint}>
              <Ionicons name="mail" size={20} color="#e74c3c" />
              <Text style={styles.bulletText}>Contact support immediately if you believe this is an error</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => Linking.openURL('mailto:support@cspc.edu.ph?subject=Lost%20%26%20Found%20Sign-in%20Help')}
          >
            <Ionicons name="mail" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.supportButtonText}>Contact Support Team</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color="#3266a8" style={{ marginRight: 4 }} />
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(35, 64, 110, 0.5)',
    zIndex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    zIndex: 2,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(230, 240, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    marginBottom: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.8,
  },
  infoCard: {
    width: '100%',
    backgroundColor: 'rgba(244, 247, 251, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletText: {
    fontSize: 15,
    color: '#666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#3266a8',
  },
  suspended: {
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  suspensionCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 235, 235, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffcccb',
  },
  suspensionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#c0392b',
    marginBottom: 16,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3266a8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    justifyContent: 'center',
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    padding: 8,
  },
  backButtonText: {
    color: '#3266a8',
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export default withInternetGuard(HelpSignInScreen);