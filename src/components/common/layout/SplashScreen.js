import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Image, Text, Easing, Dimensions, Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const SplashScreen = ({ onAnimationComplete }) => {
  // Advanced state management
  const [currentLogo, setCurrentLogo] = useState('cspc');
  const [animationPhase, setAnimationPhase] = useState('loading'); // 'loading', 'transitioning', 'revealing', 'completing'
  const [preloadComplete, setPreloadComplete] = useState(false);

  // Core animation values
  const masterOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;
  const logoBlur = useRef(new Animated.Value(10)).current;
  
  // Advanced positioning and transforms
  const logoY = useRef(new Animated.Value(-50)).current;
  const titleY = useRef(new Animated.Value(80)).current;
  const subtitleY = useRef(new Animated.Value(60)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const subtitleScale = useRef(new Animated.Value(0.9)).current;
  
  // Layered opacity controls
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  
  // Background and environmental effects
  const backgroundGradient = useRef(new Animated.Value(0)).current;
  const particleOpacity = useRef(new Animated.Value(0)).current;
  const screenTint = useRef(new Animated.Value(0)).current;

  // Premium animation configuration with enhanced timing
  const animationConfig = useMemo(() => ({
    // Refined timing for smoother experience
    preloadDelay: 200,
    logoRevealDuration: 1000,
    logoTransitionDuration: 700,
    logoDisplayDuration: 2000,
    textRevealDuration: 800,
    completionHoldDuration: 800,
    exitDuration: 500,
    
    // Professional easing curves (inspired by Apple's Human Interface Guidelines)
    enterEasing: Easing.bezier(0.25, 0.1, 0.25, 1), // easeOutCubic - smoother entrance
    exitEasing: Easing.bezier(0.4, 0, 0.6, 1),  // easeInOutCubic - balanced exit
    elasticEasing: Easing.bezier(0.34, 1.56, 0.64, 1), // easeOutBack - refined bounce
    smoothEasing: Easing.bezier(0.4, 0, 0.2, 1), // Material Design standard
    
    // Enhanced spring configurations for professional feel
    logoSpring: () => ({
      useNativeDriver: true,
      tension: 140,
      friction: 12,
      velocity: 0.1,
    }),
    textSpring: () => ({
      useNativeDriver: true,
      tension: 120,
      friction: 10,
      velocity: 0.05,
    }),
    microSpring: () => ({
      useNativeDriver: true,
      tension: 200,
      friction: 18,
      velocity: 0.2,
    }),
    gentleSpring: () => ({
      useNativeDriver: true,
      tension: 80,
      friction: 8,
      velocity: 0,
    }),
  }), []);

  // Enhanced grand finale exit sequence with professional polish
  const executeGrandFinale = useCallback(() => {
    setAnimationPhase('completing');
    
    const finaleSequence = Animated.parallel([
      // Logo finale with refined micro-interactions
      Animated.sequence([
        // Subtle anticipation bounce
        Animated.spring(logoScale, {
          toValue: 1.02,
          ...animationConfig.gentleSpring(),
          useNativeDriver: true,
        }),
        // Smooth coordinated exit
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: animationConfig.exitDuration * 0.9,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 0.95,
            duration: animationConfig.exitDuration * 1.1,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
          Animated.timing(logoY, {
            toValue: -30,
            duration: animationConfig.exitDuration,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
          // Gentle glow fade
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: animationConfig.exitDuration * 0.8,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
        ]),
      ]),
      
      // Text finale with staggered fade
      Animated.sequence([
        Animated.delay(50),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 0,
            duration: animationConfig.exitDuration * 0.8,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
          Animated.timing(titleY, {
            toValue: -20,
            duration: animationConfig.exitDuration * 0.9,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
          Animated.timing(subtitleY, {
            toValue: 15,
            duration: animationConfig.exitDuration * 0.9,
            easing: animationConfig.smoothEasing,
            useNativeDriver: true,
          }),
        ]),
      ]),
      
      // Screen transition with elegant fade
      Animated.sequence([
        Animated.delay(animationConfig.exitDuration * 0.4),
        Animated.timing(masterOpacity, {
          toValue: 0,
          duration: animationConfig.exitDuration * 0.8,
          easing: animationConfig.smoothEasing,
          useNativeDriver: true,
        }),
      ]),
    ]);

    finaleSequence.start(({ finished }) => {
      if (finished) {
        onAnimationComplete?.();
      }
    });
  }, [
    logoOpacity, logoScale, logoY, textOpacity, masterOpacity, glowOpacity,
    titleY, subtitleY, animationConfig, onAnimationComplete
  ]);

  // Sophisticated logo transition with layered effects
  const executeLogoTransition = useCallback((targetLogo, onComplete) => {
    setAnimationPhase('transitioning');
    
    const exitSequence = Animated.parallel([
      // Sophisticated exit with multiple transform layers
      Animated.timing(logoOpacity, {
        toValue: 0,
        duration: animationConfig.logoTransitionDuration * 0.4,
        easing: animationConfig.exitEasing,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 0.7,
        duration: animationConfig.logoTransitionDuration * 0.5,
        easing: animationConfig.exitEasing,
        useNativeDriver: true,
      }),
      Animated.timing(logoY, {
        toValue: -30,
        duration: animationConfig.logoTransitionDuration * 0.4,
        easing: animationConfig.exitEasing,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotation, {
        toValue: 0.15,
        duration: animationConfig.logoTransitionDuration * 0.6,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    exitSequence.start(() => {
      // Logo change happens during opacity zero
      setCurrentLogo(targetLogo);
      
      // Reset position for entrance
      logoY.setValue(50);
      logoRotation.setValue(-0.1);
      
      const entranceSequence = Animated.parallel([
        // Dramatic entrance with spring physics
        Animated.spring(logoOpacity, {
          toValue: 1,
          ...animationConfig.logoSpring(),
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          ...animationConfig.logoSpring(),
        }),
        Animated.spring(logoY, {
          toValue: 0,
          ...animationConfig.logoSpring(),
        }),
        Animated.timing(logoRotation, {
          toValue: 0,
          duration: animationConfig.logoTransitionDuration * 0.8,
          easing: animationConfig.enterEasing,
          useNativeDriver: true,
        }),
        // Subtle glow effect
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: animationConfig.logoTransitionDuration * 0.3,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0,
            duration: animationConfig.logoTransitionDuration * 0.5,
            useNativeDriver: true,
          }),
        ]),
      ]);

      entranceSequence.start(onComplete);
    });
  }, [
    logoOpacity, logoScale, logoY, logoRotation, glowOpacity,
    animationConfig, setAnimationPhase
  ]);

  // Enhanced cinematic text revelation sequence
  const revealTextContent = useCallback(() => {
    setAnimationPhase('revealing');
    
    const textSequence = Animated.sequence([
      // Refined delay for perfect timing
      Animated.delay(150),
      
      // Title entrance with elegant choreography
      Animated.parallel([
        Animated.spring(titleY, {
          toValue: 0,
          ...animationConfig.textSpring(),
        }),
        Animated.spring(titleScale, {
          toValue: 1,
          ...animationConfig.textSpring(),
        }),
        Animated.timing(textOpacity, {
          toValue: 0.95,
          duration: animationConfig.textRevealDuration * 0.8,
          easing: animationConfig.enterEasing,
          useNativeDriver: true,
        }),
        // Subtle background enhancement
        Animated.timing(backgroundGradient, {
          toValue: 1,
          duration: animationConfig.textRevealDuration,
          easing: animationConfig.smoothEasing,
          useNativeDriver: true,
        }),
      ]),
      
      // Staggered subtitle with refined micro-interaction
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(subtitleY, {
          toValue: 0,
          ...animationConfig.gentleSpring(),
        }),
        Animated.spring(subtitleScale, {
          toValue: 1,
          ...animationConfig.gentleSpring(),
        }),
        // Final text opacity refinement
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: animationConfig.textRevealDuration * 0.3,
          easing: animationConfig.smoothEasing,
          useNativeDriver: true,
        }),
      ]),
    ]);

    textSequence.start(() => {
      // Hold the complete state with refined timing
      setTimeout(() => {
        executeGrandFinale();
      }, animationConfig.completionHoldDuration);
    });
  }, [
    titleY, titleScale, subtitleY, subtitleScale, textOpacity,
    backgroundGradient, animationConfig, executeGrandFinale
  ]);

  // Master orchestration
  useEffect(() => {
    let timeouts = [];
    
    const orchestrateExperience = () => {
      // Initial setup
      setAnimationPhase('loading');
      
      // Master fade-in
      const initialReveal = Animated.timing(masterOpacity, {
        toValue: 1,
        duration: animationConfig.preloadDelay,
        useNativeDriver: true,
      });

      initialReveal.start(() => {
        // Begin logo sequence
        const logoReveal = Animated.parallel([
          Animated.spring(logoOpacity, {
            toValue: 1,
            ...animationConfig.logoSpring(),
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            ...animationConfig.logoSpring(),
          }),
          Animated.spring(logoY, {
            toValue: 0,
            ...animationConfig.logoSpring(),
          }),
        ]);

        logoReveal.start(() => {
          // Schedule logo transitions
          timeouts.push(
            setTimeout(() => {
              // Use simple fade-in for SSC logo (same as CSPC)
              setCurrentLogo('ssc');
              const sscReveal = Animated.parallel([
                Animated.spring(logoOpacity, {
                  toValue: 1,
                  ...animationConfig.logoSpring(),
                }),
                Animated.spring(logoScale, {
                  toValue: 1,
                  ...animationConfig.logoSpring(),
                }),
                Animated.spring(logoY, {
                  toValue: 0,
                  ...animationConfig.logoSpring(),
                }),
              ]);
              
              sscReveal.start(() => {
                timeouts.push(
                  setTimeout(() => {
                    // Add fade-out animation for SSC logo
                    const sscFadeOut = Animated.parallel([
                      Animated.timing(logoOpacity, {
                        toValue: 0,
                        duration: animationConfig.logoTransitionDuration * 0.4,
                        easing: animationConfig.exitEasing,
                        useNativeDriver: true,
                      }),
                      Animated.timing(logoScale, {
                        toValue: 0.8,
                        duration: animationConfig.logoTransitionDuration * 0.4,
                        easing: animationConfig.exitEasing,
                        useNativeDriver: true,
                      }),
                    ]);
                    
                    sscFadeOut.start(() => {
                      // Enhanced transition to app logo with improved animations
                      setCurrentLogo('app');
                      
                      // Set initial values for dramatic entrance
                      logoY.setValue(30);
                      logoRotation.setValue(-0.1);
                      logoScale.setValue(0.8);
                      
                      const appReveal = Animated.parallel([
                        // Main logo animations with spring physics
                        Animated.spring(logoOpacity, {
                          toValue: 1,
                          ...animationConfig.logoSpring(),
                        }),
                        Animated.spring(logoScale, {
                          toValue: 1,
                          ...animationConfig.logoSpring(),
                        }),
                        Animated.spring(logoY, {
                          toValue: 0,
                          ...animationConfig.logoSpring(),
                        }),
                        // Smooth rotation correction
                        Animated.timing(logoRotation, {
                          toValue: 0,
                          duration: animationConfig.logoTransitionDuration * 0.8,
                          easing: animationConfig.enterEasing,
                          useNativeDriver: true,
                        }),
                        // Enhanced glow effect for app logo
                        Animated.sequence([
                          Animated.timing(glowOpacity, {
                            toValue: 0.4,
                            duration: animationConfig.logoTransitionDuration * 0.3,
                            useNativeDriver: true,
                          }),
                          Animated.timing(glowOpacity, {
                            toValue: 0.1,
                            duration: animationConfig.logoTransitionDuration * 0.5,
                            useNativeDriver: true,
                          }),
                          Animated.timing(glowOpacity, {
                            toValue: 0,
                            duration: animationConfig.logoTransitionDuration * 0.2,
                            useNativeDriver: true,
                          }),
                        ]),
                      ]);
                      
                      appReveal.start(() => {
                        timeouts.push(
                          setTimeout(revealTextContent, 300)
                        );
                      });
                    });
                  }, animationConfig.logoDisplayDuration)
                );
              });
            }, animationConfig.logoDisplayDuration)
          );
        });
      });
    };

    orchestrateExperience();

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [
    executeLogoTransition, revealTextContent, masterOpacity,
    logoOpacity, logoScale, logoY, animationConfig
  ]);

  // Logo configuration matching LoginScreen style - UPDATED for better circular fitting
  const logoConfig = useMemo(() => {
    const { width } = Dimensions.get('window');
    const logoSize = Math.min(width * 0.5, 240);
    
    const baseLogoStyle = {
      width: logoSize,
      height: logoSize,
      borderRadius: logoSize / 2,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden', // This is crucial for circular clipping
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
        },
        android: {
          elevation: 8,
        },
      }),
      borderWidth: 3,
      borderColor: '#fff',
    };

    const configs = {
      cspc: {
        source: require('../../../../assets/cspc-logo.png'),
        style: baseLogoStyle,
        accessibilityLabel: 'CSPC Institution Logo',
        contentStyle: { 
          width: logoSize * 0.85, // Slightly smaller than container
          height: logoSize * 0.85,
          borderRadius: (logoSize * 0.85) / 2, // Make the image itself circular
        },
        resizeMode: 'cover', // Changed to cover for better fitting
        glowColor: '#4A90E2'
      },
      ssc: {
        source: require('../../../../assets/ssc-logo.jpg'),
        style: baseLogoStyle,
        accessibilityLabel: 'SSC Organization Logo',
        contentStyle: { 
          width: logoSize * 0.9, // Slightly smaller than container
          height: logoSize * 0.9,
          borderRadius: (logoSize * 0.9) / 2, // Make the image itself circular
        },
        resizeMode: 'cover', // Cover ensures no empty spaces
        glowColor: '#4A90E2'
      },
      app: {
        source: require('../../../../assets/logo-app.jpg'),
        style: baseLogoStyle,
        accessibilityLabel: 'Lost and Found Application Logo',
        contentStyle: { 
          width: logoSize * 0.88, // Slightly smaller than container
          height: logoSize * 0.88,
          borderRadius: (logoSize * 0.88) / 2, // Make the image itself circular
        },
        resizeMode: 'cover', // Cover for consistent circular appearance
        glowColor: '#4A90E2'
      }
    };

    return configs[currentLogo] || configs.app;
  }, [currentLogo]);

  // Advanced interpolations
  const logoRotationInterpolate = logoRotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const backgroundGradientInterpolate = backgroundGradient.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.03],
  });

  const glowIntensity = glowOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <Animated.View style={[styles.masterContainer, { opacity: masterOpacity }]}>
      {/* Subtle background enhancement */}
      <Animated.View 
        style={[
          styles.backgroundOverlay,
          { opacity: backgroundGradientInterpolate }
        ]} 
      />
      
      <View style={styles.contentContainer}>
        {/* Logo container with advanced effects */}
        <Animated.View style={styles.logoSection}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [
                  { translateY: logoY },
                  { scale: logoScale },
                  { rotate: logoRotationInterpolate }
                ]
              }
            ]}
          >
            {/* Glow effect layer */}
            <Animated.View 
              style={[
                styles.logoGlow,
                {
                  opacity: glowIntensity,
                  backgroundColor: logoConfig.glowColor,
                }
              ]} 
            />
            
            {/* Main logo */}
            <Animated.View style={[styles.logoWrapper, logoConfig.style]}>
              <Image
                source={logoConfig.source}
                style={[styles.logoImage, logoConfig.contentStyle]}
                resizeMode={logoConfig.resizeMode}
                accessibilityLabel={logoConfig.accessibilityLabel}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* Typography section with premium styling */}
        <Animated.View style={styles.typographySection}>
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: textOpacity,
                transform: [
                  { translateY: titleY },
                  { scale: titleScale }
                ]
              }
            ]}
          >
            <Text style={styles.primaryTitle} accessibilityRole="header">
              Lost & Found App
            </Text>
            <View style={styles.titleAccent} />
          </Animated.View>

          <Animated.View
            style={[
              styles.subtitleContainer,
              {
                opacity: textOpacity,
                transform: [
                  { translateY: subtitleY },
                  { scale: subtitleScale }
                ]
              }
            ]}
          >
            <Text style={styles.primarySubtitle}>
              Camarines Sur Polytechnic Colleges
            </Text>
            <Text style={styles.secondarySubtitle}>
              Campus Solutions
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, currentLogo === 'cspc' && styles.statusActive]} />
        <View style={[styles.statusDot, currentLogo === 'ssc' && styles.statusActive]} />
        <View style={[styles.statusDot, currentLogo === 'app' && styles.statusActive]} />
        <View style={[styles.statusDot, animationPhase === 'revealing' && styles.statusActive]} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  masterContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(102, 126, 234, 0.03)',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 70,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  logoGlow: {
    position: 'absolute',
    width: Math.min(screenWidth * 0.7, 300),
    height: Math.min(screenWidth * 0.7, 300),
    borderRadius: 1000,
    opacity: 0.08,
  },
  logoWrapper: {
    // Container for the logo image - styles come from logoConfig
  },
  logoImage: {
    // Image styles come from logoConfig.contentStyle
  },
  typographySection: {
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryTitle: {
    fontSize: Math.min(screenWidth * 0.09, 38),
    fontWeight: '700',
    color: '#2D3748',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: Math.min(screenWidth * 0.11, 46),
    ...Platform.select({
      ios: {
        fontFamily: 'SF Pro Display',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  titleAccent: {
    width: 50,
    height: 2.5,
    backgroundColor: '#667eea',
    borderRadius: 1.5,
    marginTop: 12,
    opacity: 0.8,
  },
  subtitleContainer: {
    alignItems: 'center',
  },
  primarySubtitle: {
    fontSize: Math.min(screenWidth * 0.042, 18),
    fontWeight: '500',
    color: '#4A5568',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: Math.min(screenWidth * 0.055, 24),
    ...Platform.select({
      ios: {
        fontFamily: 'SF Pro Text',
      },
      android: {
        fontFamily: 'sans-serif',
      },
    }),
  },
  secondarySubtitle: {
    fontSize: Math.min(screenWidth * 0.032, 14),
    fontWeight: '400',
    color: '#718096',
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
    opacity: 0.9,
    ...Platform.select({
      ios: {
        fontFamily: 'SF Pro Text',
      },
      android: {
        fontFamily: 'sans-serif',
      },
    }),
  },
  statusContainer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 5,
    opacity: 0.6,
  },
  statusActive: {
    backgroundColor: '#667eea',
    opacity: 1,
    transform: [{ scale: 1.3 }],
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});

export default SplashScreen;