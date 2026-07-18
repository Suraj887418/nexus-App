import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator, Alert, Dimensions, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as ImageManipulator from 'expo-image-manipulator';
import { GlobalStore, API_BASE_URL } from '../store';

const { width } = Dimensions.get('window');

export default function BiometricScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isCheckInMode = params.mode === 'checkin';
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'success' | 'mismatch'>('idle');
  const [deviceStatus, setDeviceStatus] = useState<'checking' | 'registered' | 'mismatch'>('checking');
  
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    // Simulate checking device binding
    setTimeout(() => {
      setDeviceStatus('registered');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 1500);

    // Setup pulsing animation for idle state
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const startScan = async () => {
    if (deviceStatus !== 'registered') return;
    if (!permission?.granted) {
      Alert.alert("Permission Required", "Camera permission is required for face authentication.");
      return;
    }
    
    setScanState('scanning');

    // Scanning animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    try {
      // Capture Photo instantly with high quality so AI can accurately extract features!
      const photo = await cameraRef.current?.takePictureAsync({ base64: false, quality: 0.7, shutterSound: false });
      
      if (!photo?.uri) throw new Error("Failed to capture image");

      // Resize and fix EXIF orientation
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipResult.base64) throw new Error("Failed to process image");

      let lat = null;
      let lng = null;
      let deviceImei = null;
      let deviceId = null;
      let deviceMeta = null;

      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        }
      } catch (locErr) { console.log('Location error:', locErr); }

      try {
        deviceImei = Device.osBuildId || Device.modelName || 'Unknown Device';
        deviceId = Device.osInternalBuildId || deviceImei;
        deviceMeta = JSON.stringify({
          model: Device.modelName,
          os: Device.osName,
          version: Device.osVersion,
          brand: Device.brand
        });
      } catch(e) {}

      // Send to API based on mode
      const apiEndpoint = isCheckInMode ? '/api/check-in' : '/api/face-auth';
      const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: GlobalStore.userEmail, 
          image: `data:image/jpeg;base64,${manipResult.base64}`,
          lat,
          lng,
          deviceImei,
          deviceId,
          deviceMeta
        }),
      });
      
      const textResult = await response.text();
      let data;
      try {
        data = JSON.parse(textResult);
      } catch (err) {
        throw new Error("Backend not updated. Please restart your 'node server.js' terminal.");
      }

      if (data.success) {
        scanLineAnim.stopAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setScanState('success');
        GlobalStore.setFaceVerified(true);
        
        // Navigate appropriately
        setTimeout(() => {
          if (isCheckInMode) {
            router.back();
          } else {
            router.replace('/(tabs)/dashboard');
          }
        }, 1000);
      } else {
        throw new Error(data.message || "Face not recognized");
      }
    } catch (error: any) {
      scanLineAnim.stopAnimation();
      setScanState('mismatch');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Authentication Failed", error.message || "Failed to verify face.");
      
      // Reset after a delay
      setTimeout(() => setScanState('idle'), 2000);
    }
  };

  // Permission UI
  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#5F35C7" /></View>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera" size={60} color="#5F35C7" />
          <Text style={styles.permissionTitle}>Camera Required</Text>
          <Text style={styles.permissionDesc}>Face authentication needs camera access to verify your identity.</Text>
          <Pressable style={styles.btnPrimary} onPress={requestPermission}>
            <Text style={styles.btnText}>Allow Access</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1F2937" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {isCheckInMode ? 'Attendance Check-In' : 'Identity Verification'}
          </Text>
        </View>
        <Text style={styles.subtitle}>
          {isCheckInMode ? 'Face-Scan is required to mark your attendance.' : 'Face-Scan is required to access your workspace.'}
        </Text>
      </View>

      <View style={styles.statusBadgeContainer}>
        {deviceStatus === 'checking' && (
          <View style={styles.statusBadge}>
            <ActivityIndicator size="small" color="#64748B" style={{marginRight: 6}} />
            <Text style={styles.statusText}>Checking Device...</Text>
          </View>
        )}
        {deviceStatus === 'registered' && (
          <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="hardware-chip" size={16} color="#10B981" style={{marginRight: 6}} />
            <Text style={[styles.statusText, { color: '#10B981' }]}>Device Registered</Text>
          </View>
        )}
      </View>

      <View style={styles.scanContainer}>
        <Animated.View style={[
          styles.scanCircleOuter, 
          { transform: [{ scale: scanState === 'idle' ? pulseAnim : 1 }] }
        ]}>
          <View style={styles.scanCircleInner}>
            {/* Live Camera View */}
            <CameraView 
              style={StyleSheet.absoluteFillObject} 
              facing="front" 
              ref={cameraRef}
              mute={true}
            />
            
            {/* Scanning Line overlay */}
            {scanState === 'scanning' && (
              <Animated.View 
                style={[
                  styles.scanLine, 
                  {
                    transform: [{
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-120, 120]
                      })
                    }]
                  }
                ]} 
              />
            )}

            {/* Success Overlay */}
            {scanState === 'success' && (
              <View style={styles.successOverlay}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </View>
            )}

            {/* Error Overlay */}
            {scanState === 'mismatch' && (
              <View style={styles.errorOverlay}>
                <Ionicons name="close-circle" size={80} color="#EF4444" />
              </View>
            )}
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Pressable 
          style={({pressed}) => [
            styles.scanButton, 
            pressed && styles.scanButtonPressed,
            scanState === 'scanning' && styles.scanButtonDisabled
          ]} 
          onPress={startScan}
          disabled={scanState === 'scanning' || deviceStatus !== 'registered'}
        >
          {scanState === 'scanning' ? (
            <Text style={styles.scanButtonText}>Scanning...</Text>
          ) : scanState === 'success' ? (
            <Text style={styles.scanButtonText}>Verified!</Text>
          ) : (
            <Text style={styles.scanButtonText}>Authenticate Identity</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionDesc: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  btnPrimary: {
    backgroundColor: '#5F35C7',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    marginTop: 60,
    paddingHorizontal: 20,
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500'
  },
  statusBadgeContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCircleOuter: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 4,
    borderColor: '#5F35C7',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    elevation: 20,
    shadowColor: '#5F35C7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  scanCircleInner: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // Crucial for circular camera crop
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 4,
    backgroundColor: '#5F35C7',
    shadowColor: '#5F35C7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  footer: {
    padding: 30,
    paddingBottom: 50,
  },
  scanButton: {
    backgroundColor: '#5F35C7',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#5F35C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scanButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#4A2A9C',
  },
  scanButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  }
});
