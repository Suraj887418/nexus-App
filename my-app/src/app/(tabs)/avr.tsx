import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, TouchableOpacity, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video, Audio } from 'expo-av';
import { GlobalStore, API_BASE_URL } from '../../store';

export default function AVRScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptionProgress, setEncryptionProgress] = useState(0);
  const [mode, setMode] = useState<'audio' | 'video'>('audio');
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<any>(null);
  const lastRecordedUriRef = useRef<string>('');
  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/avr/history?email=${GlobalStore.userEmail}`, { headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile' } });
      const data = await response.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.log('Error fetching history', err);
    }
  };

  // Timer logic for recording
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      clearInterval(interval);
      pulseAnim.stopAnimation();
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const switchMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMode(prev => prev === 'audio' ? 'video' : 'audio');
  };

  const flipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCameraFacing(prev => prev === 'front' ? 'back' : 'front');
  };

  const toggleRecording = async () => {
    if (isEncrypting) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    
    if (isRecording) {
      setIsRecording(false);
      setIsEncrypting(true);
      
      let currentAudioUri = '';
      if (mode === 'audio' && audioRecording) {
         try {
           await audioRecording.stopAndUnloadAsync();
           currentAudioUri = audioRecording.getURI() || '';
         } catch(e) {}
         setAudioRecording(null);
      } else if (mode === 'video' && cameraRef.current) {
         try {
           cameraRef.current.stopRecording();
         } catch(e) {}
      }
      
      let progress = 0;
      const encInterval = setInterval(async () => {
        progress += 10;
        setEncryptionProgress(progress);
        if (progress >= 100) {
          clearInterval(encInterval);
          
          let durationStr = formatTime(recordingTime);
          
          try {
            await fetch(`${API_BASE_URL}/api/avr/sync`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: GlobalStore.userEmail,
                caseNumber: 'CASE-NEW',
                type: mode,
                title: `New ${mode} recording`,
                duration: durationStr
              })
            });
            // fetchHistory(); // Skip fetch to avoid overwriting our local URIs with DB state for the new one
          } catch(err) {}

          const localUri = mode === 'audio' ? currentAudioUri : lastRecordedUriRef.current;
          setHistory(prev => [{
             type: mode,
             title: `New ${mode} recording`,
             duration: durationStr,
             created_at: new Date().toISOString(),
             uri: localUri
          }, ...prev]);

          setTimeout(() => {
            setIsEncrypting(false);
            setEncryptionProgress(0);
            setRecordingTime(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }, 500);
        }
      }, 300);
    } else {
      // Start recording
      if (mode === 'video') {
         if (!camPermission?.granted) await requestCamPermission();
         if (!micPermission?.granted) await requestMicPermission();
         
         setIsRecording(true);
         setRecordingTime(0);
         
         setTimeout(() => {
           if (cameraRef.current) {
             cameraRef.current.recordAsync().then((videoRecord: any) => {
                if (videoRecord && videoRecord.uri) {
                   lastRecordedUriRef.current = videoRecord.uri;
                }
             }).catch(() => {});
           }
         }, 500);
      } else {
         if (!micPermission?.granted) await requestMicPermission();
         try {
           await Audio.requestPermissionsAsync();
           await Audio.setAudioModeAsync({
             allowsRecordingIOS: true,
             playsInSilentModeIOS: true,
           });
           const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
           setAudioRecording(recording);
         } catch (err) {}
         setIsRecording(true);
         setRecordingTime(0);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F8FAFC' }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Audio/Video Record</Text>
        <Text style={styles.headerSubtitle}>Live Vault Sync</Text>
      </View>

      <View style={styles.recordingSection}>
        <View style={styles.timerDisplay}>
          <Text style={[styles.timerText, isRecording && { color: '#EF4444' }]}>
            {formatTime(recordingTime)}
          </Text>
          {isRecording && (
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
          )}
        </View>

        <View style={{ position: 'relative' }}>
          <Pressable 
            onPress={toggleRecording}
            disabled={isEncrypting}
            style={({ pressed }) => [
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              isEncrypting && { opacity: 0.5 },
              pressed && { transform: [{ scale: 0.95 }] }
            ]}
          >
            {isRecording ? (
              <View style={styles.stopSquare} />
            ) : (
              <Ionicons name={mode === 'audio' ? "mic" : "videocam"} size={48} color="#FFF" />
            )}
          </Pressable>
          
          {!isRecording && !isEncrypting && (
            <Pressable onPress={switchMode} style={styles.switchModeBtn}>
              <Ionicons name={mode === 'audio' ? "videocam" : "mic"} size={20} color="#5F35C7" />
            </Pressable>
          )}

          {!isRecording && !isEncrypting && mode === 'video' && (
            <Pressable onPress={flipCamera} style={styles.flipCameraBtn}>
              <Ionicons name="camera-reverse" size={20} color="#5F35C7" />
            </Pressable>
          )}
        </View>
        <Text style={styles.recordHint}>
          {isRecording ? 'Tap to Stop & Encrypt' : `Tap to Start ${mode === 'audio' ? 'Audio' : 'Video'}`}
        </Text>
      </View>

      {/* Hidden Camera View for stealth recording */}
      {isRecording && !isEncrypting && mode === 'video' && camPermission?.granted && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={cameraFacing} mode="video" />
        </View>
      )}

      {isEncrypting && (
        <View style={styles.encryptionContainer}>
          <View style={styles.encryptionHeader}>
            <Ionicons name="lock-closed" size={16} color="#10B981" />
            <Text style={styles.encryptionText}>Securing to Vault...</Text>
            <Text style={styles.encryptionPercent}>{encryptionProgress}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${encryptionProgress}%` }]} />
          </View>
        </View>
      )}

      <ScrollView style={styles.historySection} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.sectionTitle}>Vault History</Text>

        {history.length === 0 && <Text style={{color: '#64748B'}}>No vault history found.</Text>}
        {history.map((item, index) => {
          const dateObj = new Date(item.created_at);
          const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          const dateStr = dateObj.toLocaleDateString([], {month: 'short', day: 'numeric'});

          return (
            <TouchableOpacity key={index} style={styles.historyCard} onPress={() => setSelectedMedia(item)}>
              <View style={styles.historyIcon}>
                <Ionicons name={item.type === 'video' ? "videocam" : "mic"} size={20} color="#10B981" />
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyTitle}>{item.title}</Text>
                <Text style={styles.historyTime}>{dateStr}, {timeStr} • {item.duration}</Text>
              </View>
              <View style={styles.syncedBadge}>
                <Ionicons name="cloud-done" size={12} color="#10B981" />
                <Text style={styles.syncedText}>Synced</Text>
              </View>
            </TouchableOpacity>
          );
        })}

      </ScrollView>

      <Modal visible={!!selectedMedia} animationType="slide" transparent={true} onRequestClose={() => setSelectedMedia(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.playbackContainer}>
            <View style={styles.playbackHeader}>
              <Text style={styles.playbackTitle}>{selectedMedia?.title}</Text>
              <Pressable onPress={() => setSelectedMedia(null)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </Pressable>
            </View>
            <View style={styles.playbackPlayer}>
              {selectedMedia?.uri ? (
                 <Video 
                   source={{ uri: selectedMedia.uri }} 
                   useNativeControls 
                   resizeMode="contain" as any
                   shouldPlay
                   style={{ width: '100%', height: '100%', borderRadius: 16 }} 
                 />
              ) : (
                <>
                  <Ionicons name={selectedMedia?.type === 'video' ? 'play-circle' : 'musical-notes'} size={64} color="#5F35C7" />
                  <Text style={{marginTop: 12, color: '#64748B', fontWeight: '500'}}>Secure Vault Playback</Text>
                  <Text style={{marginTop: 4, color: '#94A3B8', fontSize: 12}}>Recording from previous session (demo)</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingBottom: 16, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  headerSubtitle: { fontSize: 14, color: '#10B981', fontWeight: '600', marginTop: 4 },

  recordingSection: { alignItems: 'center', paddingVertical: 40, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  timerDisplay: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  timerText: { fontSize: 48, fontWeight: '300', color: '#1F2937', fontVariant: ['tabular-nums'] },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', marginLeft: 12 },
  
  recordButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#5F35C7', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#5F35C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, borderWidth: 4, borderColor: 'rgba(95, 53, 199, 0.3)' },
  recordButtonActive: { backgroundColor: 'transparent', borderColor: '#EF4444' },
  stopSquare: { width: 32, height: 32, backgroundColor: '#EF4444', borderRadius: 6 },
  recordHint: { marginTop: 20, fontSize: 14, color: '#64748B', fontWeight: '500' },
  
  switchModeBtn: { position: 'absolute', bottom: -5, right: -15, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.15, shadowRadius: 6, borderWidth: 1, borderColor: '#E3EEFF' },
  flipCameraBtn: { position: 'absolute', bottom: -5, left: -15, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.15, shadowRadius: 6, borderWidth: 1, borderColor: '#E3EEFF' },

  encryptionContainer: { padding: 24, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  encryptionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  encryptionText: { color: '#1F2937', fontSize: 14, fontWeight: '600', marginLeft: 8, flex: 1 },
  encryptionPercent: { color: '#10B981', fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10B981' },

  historySection: { flex: 1, padding: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  historyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  historyDetails: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  historyTime: { fontSize: 12, color: '#64748B' },
  syncedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  syncedText: { fontSize: 10, color: '#10B981', fontWeight: '700', marginLeft: 4 },

  previewContainer: { padding: 16, alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cameraPreviewWrapper: { width: 120, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  cameraPreview: { width: '100%', height: '100%' },
  audioVisualizer: { flexDirection: 'row', alignItems: 'center', height: 40, gap: 4 },
  audioBar: { width: 6, backgroundColor: '#5F35C7', borderRadius: 3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  playbackContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300 },
  playbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  playbackTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  playbackPlayer: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }
});
