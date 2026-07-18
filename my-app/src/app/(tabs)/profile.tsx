import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Animated, Modal, Image, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Device from 'expo-device';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { GlobalStore, API_BASE_URL } from '../../store';

const { width, height } = Dimensions.get('window');

type DocState = {
  status: 'Uploaded' | 'Pending';
  uri: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // eKYC State
  const [isEkycVerified, setIsEkycVerified] = useState(false);
  const [ekycLoading, setEkycLoading] = useState(false);
  const [isEkycModalVisible, setIsEkycModalVisible] = useState(false);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [ekycOtp, setEkycOtp] = useState('');
  const [ekycStep, setEkycStep] = useState(1);

  // Document State
  const [documents, setDocuments] = useState<Record<string, DocState>>({
    aadhaarFront: { status: 'Pending', uri: null },
    aadhaarBack: { status: 'Pending', uri: null },
    panCard: { status: 'Pending', uri: null },
    cheque: { status: 'Pending', uri: null }
  });

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const scanAnim = useRef(new Animated.Value(0)).current;

  // View Doc State
  const [viewDocUri, setViewDocUri] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (isCameraOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [isCameraOpen]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile?email=${GlobalStore.userEmail}`, { headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile' } });
      const data = await response.json();
      if (data.success && data.profile) {
        setName(data.profile.name || '');
        setMobile(data.profile.mobile || '');
        setAddress(data.profile.address || '');
        setIsEkycVerified(!!data.profile.ekyc_verified);
      }
    } catch (err) {
      console.log('Error fetching profile', err);
    }
  };

  const deviceName = Device.modelName || Device.deviceName || 'Unknown Device';
  const deviceId = Device.osBuildId || Device.osInternalBuildId || 'Unknown ID';

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: GlobalStore.userEmail, name, mobile, address })
      });
      const data = await response.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setIsEditing(false);
        Alert.alert("Profile Updated", "Your information has been securely updated.");
      } else {
        Alert.alert("Update Failed", data.message);
      }
    } catch (err) {
      Alert.alert("Error", "Could not connect to server");
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: GlobalStore.userEmail, newPassword })
      });
      const data = await response.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert("Security Update", "Password changed successfully.");
      } else {
        Alert.alert("Update Failed", data.message);
      }
    } catch (err) {
      Alert.alert("Error", "Could not connect to server");
    }
  };

  const handleEkyc = async () => {
    if (isEkycVerified) return;
    setEkycLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const response = await fetch(`${API_BASE_URL}/api/ekyc/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: GlobalStore.userEmail })
      });
      const data = await response.json();
      setEkycLoading(false);
      if (data.success) {
        setIsEkycVerified(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert("eKYC Successful", "Your identity has been verified securely.");
      } else {
        Alert.alert("eKYC Failed", data.message);
      }
    } catch (err) {
      setEkycLoading(false);
      Alert.alert("Error", "Could not connect to server");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Secure Logout",
      "Are you sure you want to exit your workspace?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: () => {
            setIsLoggingOut(true);
            setTimeout(() => {
              setIsLoggingOut(false);
              router.replace('/');
            }, 1000);
          }
        }
      ]
    );
  };

  const handleSendEkycOtp = () => {
    if (aadhaarNumber.length < 12) {
      Alert.alert("Invalid Aadhaar", "Please enter a valid 12-digit Aadhaar number.");
      return;
    }
    setEkycLoading(true);
    setTimeout(() => {
      setEkycLoading(false);
      setEkycStep(2);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 1500);
  };

  const handleVerifyEkyc = async () => {
    if (ekycOtp.length < 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP.");
      return;
    }
    setEkycLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/verify-ekyc`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        setIsEkycVerified(true);
        setIsEkycModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert("eKYC Complete", "Your identity has been securely verified.");
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      Alert.alert("Error", "Could not verify eKYC.");
    } finally {
      setEkycLoading(false);
    }
  };

  const openScanner = async (docKey: string) => {
    if (!isEditing) return;
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan documents.");
        return;
      }
    }
    setActiveDocKey(docKey);
    setIsCameraOpen(true);
  };

  const takePictureAndUpload = async () => {
    if (cameraRef.current && activeDocKey) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        
        // Mock upload delay
        setTimeout(() => {
          setDocuments(prev => ({
            ...prev,
            [activeDocKey]: { status: 'Uploaded', uri: photo.uri }
          }));
          setIsCameraOpen(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Alert.alert("Success", "Document scanned and uploaded successfully.");
        }, 800);
      } catch (err) {
        Alert.alert("Error", "Failed to capture document.");
      }
    }
  };

  const deleteDocument = (docKey: string) => {
    if (!isEditing) return;
    Alert.alert("Delete", "Are you sure you want to remove this document?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        setDocuments(prev => ({
          ...prev,
          [docKey]: { status: 'Pending', uri: null }
        }));
      }}
    ]);
  };

  const viewDocument = (uri: string | null) => {
    if (uri) {
      setViewDocUri(uri);
    } else {
      Alert.alert("Info", "Document preview is not available for this legacy record.");
    }
  };

  const renderDocCard = (key: string, title: string) => {
    const doc = documents[key];
    const isUploaded = doc.status === 'Uploaded';
    const pendingColor = isEditing ? '#4e54d4' : '#EF4444';
    const bgColor = isUploaded ? '#F0FDF4' : '#FFFFFF';
    const borderColor = isUploaded ? '#10B981' : pendingColor;
    
    return (
      <View key={key} style={[styles.docCard, { backgroundColor: bgColor, borderColor: borderColor }]}>
        <View style={[styles.docIconBox, { backgroundColor: isUploaded ? '#10B981' : pendingColor }]}>
           <Ionicons name={isUploaded ? "checkmark-circle-outline" : "camera-outline"} size={24} color="#FFF" />
        </View>
        <Text style={[styles.docTitle, { color: isUploaded ? '#10B981' : pendingColor }]}>{title}</Text>
        
        {!isUploaded ? (
          <Pressable 
             disabled={!isEditing} 
             onPress={() => openScanner(key)}
             style={{ marginTop: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: isEditing ? 'rgba(78,84,212,0.1)' : 'transparent' }}
          >
            <Text style={[styles.docSubtitle, { color: pendingColor }]}>
              {isEditing ? 'Tap to scan' : 'Upload Pending'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.docActions}>
            <Pressable onPress={() => viewDocument(doc.uri)} style={styles.docActionBtn}>
              <Ionicons name="eye-outline" size={16} color="#10B981" />
              <Text style={{color: '#10B981', fontSize: 12, marginLeft: 4}}>View</Text>
            </Pressable>
            {isEditing && (
              <Pressable onPress={() => deleteDocument(key)} style={styles.docActionBtn}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={{color: '#EF4444', fontSize: 12, marginLeft: 4}}>Delete</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F8FAFC' }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Security</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : 'S'}</Text>
            </View>
            <View style={styles.headerDetails}>
              <Text style={styles.empId}>{name || 'Employee'}</Text>
              <Text style={styles.designation}>{GlobalStore.userEmail}</Text>
            </View>
            <Pressable onPress={() => setIsEditing(!isEditing)} style={[styles.editBtn, isEditing && { backgroundColor: '#4e54d4' }]}>
              <Ionicons name={isEditing ? "close" : "pencil"} size={20} color={isEditing ? "#FFF" : "#5F35C7"} />
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={[styles.inputBox, isEditing && styles.inputBoxActive]}>
              <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={name}
                onChangeText={setName}
                editable={isEditing}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={[styles.inputBox, isEditing && styles.inputBoxActive]}>
              <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={mobile}
                onChangeText={setMobile}
                editable={isEditing}
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Residential Address</Text>
            <View style={[styles.inputBox, isEditing && styles.inputBoxActive]}>
              <Ionicons name="location-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                editable={isEditing}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {isEditing && (
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>Identity Verification</Text>
        <View style={styles.card}>
          <View style={styles.ekycHeader}>
            <Ionicons name="id-card" size={36} color="#5F35C7" />
            <View style={styles.ekycInfo}>
              <Text style={styles.ekycTitle}>eKYC Registration</Text>
              <Text style={styles.ekycSubtitle}>Verify your Aadhaar/PAN to access sensitive field tools.</Text>
            </View>
          </View>
          
          <Pressable 
            style={[styles.ekycBtn, isEkycVerified && styles.ekycBtnSuccess]} 
            onPress={handleEkyc}
            disabled={isEkycVerified || ekycLoading}
          >
            {ekycLoading ? (
              <Text style={styles.ekycBtnText}>Verifying...</Text>
            ) : isEkycVerified ? (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.ekycBtnText}>Verified</Text>
              </>
            ) : (
              <Text style={styles.ekycBtnText}>Initiate eKYC</Text>
            )}
          </Pressable>
        </View>

        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 16}}>
           <Text style={[styles.sectionTitle, {marginTop: 0, marginBottom: 0}]}>Upload Documents</Text>
           {isEditing && <Text style={{color: '#4e54d4', fontSize: 12, fontWeight: 'bold'}}>Edit Mode Active</Text>}
        </View>
        <View style={styles.documentGrid}>
          {renderDocCard('aadhaarFront', 'Aadhaar Front')}
          {renderDocCard('aadhaarBack', 'Aadhaar Back')}
          {renderDocCard('panCard', 'PAN Card')}
          {renderDocCard('cheque', 'Cheque')}
        </View>

        <View style={[styles.card, { marginTop: 16, padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <View style={{ width: 40, height: 48, backgroundColor: '#5F35C7', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Ionicons name="person-circle" size={24} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 4 }}>eKYC Registration</Text>
              <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>Verify your Aadhaar/PAN to access sensitive field tools.</Text>
            </View>
          </View>
          <Pressable 
            style={({pressed}) => [{ backgroundColor: isEkycVerified ? '#10B981' : '#F59E0B', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }, pressed && !isEkycVerified && {opacity: 0.8}]}
            onPress={() => { if(!isEkycVerified) setIsEkycModalVisible(true); }}
            disabled={isEkycVerified}
          >
            <Ionicons name={isEkycVerified ? "checkmark-circle" : "link"} size={16} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>{isEkycVerified ? "eKYC Completed" : "Verify eKYC Now"}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Security Settings</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={[styles.inputBox, styles.inputBoxActive]}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputBox, styles.inputBoxActive]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Confirm new password"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Pressable style={styles.updateBtn} onPress={handlePasswordChange}>
            <Text style={styles.updateBtnText}>Update Password</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Device Registry</Text>
        <View style={styles.deviceCard}>
          <View style={styles.deviceIcon}>
            <Ionicons name="phone-portrait" size={28} color="#10B981" />
          </View>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceModel}>{deviceName}</Text>
            <Text style={styles.deviceId}>ID: {deviceId}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#10B981" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout} disabled={isLoggingOut}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>{isLoggingOut ? "Securing Session..." : "Secure Logout"}</Text>
        </Pressable>
      </ScrollView>

      {/* eKYC Modal */}
      <Modal visible={isEkycModalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 20, padding: 24, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1F2937' }}>Digital eKYC</Text>
              <Pressable onPress={() => { setIsEkycModalVisible(false); setEkycStep(1); setAadhaarNumber(''); setEkycOtp(''); }}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </Pressable>
            </View>

            {ekycStep === 1 ? (
              <View>
                <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}>Enter your 12-digit Aadhaar number for digital verification.</Text>
                <View style={[styles.inputBox, styles.inputBoxActive, { marginBottom: 20 }]}>
                  <Ionicons name="card-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="e.g. 1234 5678 9012" 
                    value={aadhaarNumber} 
                    onChangeText={setAadhaarNumber} 
                    keyboardType="number-pad"
                    maxLength={12}
                  />
                </View>
                <Pressable style={[styles.updateBtn, { opacity: ekycLoading ? 0.7 : 1 }]} onPress={handleSendEkycOtp} disabled={ekycLoading}>
                  <Text style={styles.updateBtnText}>{ekycLoading ? "Sending OTP..." : "Send OTP"}</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 14, color: '#10B981', marginBottom: 16, fontWeight: '600' }}>OTP sent successfully to registered mobile number.</Text>
                <View style={[styles.inputBox, styles.inputBoxActive, { marginBottom: 20 }]}>
                  <Ionicons name="keypad-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Enter 6-digit OTP" 
                    value={ekycOtp} 
                    onChangeText={setEkycOtp} 
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <Pressable style={[styles.updateBtn, { backgroundColor: '#10B981', opacity: ekycLoading ? 0.7 : 1 }]} onPress={handleVerifyEkyc} disabled={ekycLoading}>
                  <Text style={styles.updateBtnText}>{ekycLoading ? "Verifying..." : "Verify Aadhaar"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Camera Modal */}
      <Modal visible={isCameraOpen} animationType="slide" transparent={false}>
        <View style={styles.cameraContainer}>
          {permission?.granted && (
            <CameraView style={styles.camera} facing="back" ref={cameraRef}>
              <SafeAreaView style={styles.cameraOverlay}>
                <View style={styles.cameraHeader}>
                  <Pressable onPress={() => setIsCameraOpen(false)} style={styles.closeCameraBtn}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </Pressable>
                  <Text style={styles.cameraTitle}>Scan Document</Text>
                  <View style={{width: 28}}/>
                </View>

                <View style={styles.scanTargetContainer}>
                  <View style={styles.scanTarget}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    
                    <Animated.View style={[styles.scanLine, { 
                      transform: [{ 
                        translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }) 
                      }] 
                    }]} />
                  </View>
                  <Text style={styles.scanHint}>Align document within the frame</Text>
                </View>

                <View style={styles.cameraControls}>
                  <Pressable onPress={takePictureAndUpload} style={styles.captureBtn}>
                    <View style={styles.captureBtnInner} />
                  </Pressable>
                </View>
              </SafeAreaView>
            </CameraView>
          )}
        </View>
      </Modal>

      {/* View Document Modal */}
      <Modal visible={!!viewDocUri} animationType="fade" transparent={true}>
         <View style={styles.viewDocOverlay}>
           <SafeAreaView style={{flex: 1, width: '100%'}}>
             <View style={styles.viewDocHeader}>
                <Text style={styles.viewDocTitle}>Document Preview</Text>
                <Pressable onPress={() => setViewDocUri(null)} style={styles.viewDocClose}>
                  <Ionicons name="close" size={28} color="#FFF" />
                </Pressable>
             </View>
             {viewDocUri && <Image source={{ uri: viewDocUri }} style={styles.viewDocImage} resizeMode="contain" />}
           </SafeAreaView>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingBottom: 16, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 16, marginTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 16 },
  avatarContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(95, 53, 199, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#5F35C7' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#5F35C7' },
  headerDetails: { flex: 1, marginLeft: 16 },
  empId: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
  designation: { fontSize: 13, color: '#64748B', marginTop: 2 },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(95, 53, 199, 0.1)', justifyContent: 'center', alignItems: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12, height: 50, borderWidth: 1, borderColor: '#E2E8F0' },
  inputBoxActive: { borderColor: '#5F35C7', backgroundColor: '#FFFFFF' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#1F2937', fontSize: 15, fontWeight: '500' },
  saveBtn: { backgroundColor: '#10B981', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  ekycHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  ekycInfo: { marginLeft: 16, flex: 1 },
  ekycTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  ekycSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 18 },
  ekycBtn: { backgroundColor: '#5F35C7', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8, flexDirection: 'row' },
  ekycBtnSuccess: { backgroundColor: '#10B981' },
  ekycBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  documentGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  docCard: { width: '48%', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', marginBottom: 16, borderWidth: 2 },
  docIconBox: { paddingHorizontal: 24, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  docTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  docSubtitle: { fontSize: 11, fontWeight: '600' },
  docActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, width: '100%', paddingHorizontal: 4 },
  docActionBtn: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  updateBtn: { backgroundColor: '#5F35C7', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  updateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 40, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4 },
  deviceIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  deviceInfo: { flex: 1 },
  deviceModel: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  deviceId: { fontSize: 12, color: '#64748B', fontFamily: 'monospace' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  verifiedText: { fontSize: 11, color: '#10B981', fontWeight: '700', marginLeft: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '700', marginLeft: 8 },

  // Camera Styles
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between' },
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20 },
  closeCameraBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  scanTargetContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { width: width * 0.8, height: 200, borderWidth: 0, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#10B981', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanLine: { width: '100%', height: 2, backgroundColor: '#10B981', position: 'absolute', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
  scanHint: { color: '#FFF', marginTop: 30, fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  cameraControls: { paddingBottom: 40, alignItems: 'center' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },

  // View Doc Styles
  viewDocOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  viewDocHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  viewDocTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  viewDocClose: { padding: 8 },
  viewDocImage: { flex: 1, width: '100%' }
});
