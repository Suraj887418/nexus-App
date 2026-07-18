import React, { useState, useEffect, useRef } from 'react';
import {  View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GlobalStore, API_BASE_URL } from '../store';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [pulseAnim] = useState(new Animated.Value(0.3));
  const [clock, setClock] = useState("09:05:00 AM");
  const [taskStats, setTaskStats] = useState({ total: 10, completed: 7 });
  const [checkInStatus, setCheckInStatus] = useState({ checkedIn: false, time: '--:--' });
  const [casesList, setCasesList] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-width)).current;

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      Animated.timing(drawerAnim, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true })
      ])
    ).start();

    const fetchDashboardData = async () => {
      try {
        const email = GlobalStore.userEmail;
        
        // Fetch stats
        const statsRes = await fetch(`${API_BASE_URL}/api/dashboard-stats?email=${email}`, { headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile' } });
        const statsData = await statsRes.json();
        if (statsData.success) {
          setTaskStats({ total: statsData.totalTasks, completed: statsData.completedTasks });
          if (statsData.checkedIn) {
            setCheckInStatus({ checkedIn: true, time: statsData.checkInTime });
          }
        }

        // Fetch cases
        const casesRes = await fetch(`${API_BASE_URL}/api/cases?email=${email}`, { headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile' } });
        const casesData = await casesRes.json();
        if (casesData.success) {
          setCasesList(casesData.cases);
        }
      } catch (err) {
        console.log("Fetch API error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    
    // Simulate live clock
    const timer = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleProfilePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/(tabs)/profile');
  };

  const handleCheckIn = async () => {
    if (checkInStatus.checkedIn) {
      Alert.alert("Already Checked In", `You checked in at ${checkInStatus.time}`);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/check-in`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: GlobalStore.userEmail })});
      const data = await response.json();
      if (data.success) {
        setCheckInStatus({ checkedIn: true, time: data.checkInTime });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert("Success", `Checked in successfully at ${data.checkInTime}`);
      } else {
        Alert.alert("Failed", data.message);
      }
    } catch (err) {
      Alert.alert("Error", "Could not connect to server");
    }
  };

  const openWorkspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/(tabs)/workspace');
  };

  const openAVR = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert("Live Vault", "Starting secure recording...");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F8FAFC' }} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </Pressable>
        <Pressable 
          style={({pressed}) => [{flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 12}, pressed && { opacity: 0.8 }]}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <View style={styles.avatarContainer}>
            <Image source={{uri: `https://ui-avatars.com/api/?name=${GlobalStore.userName || 'Employee'}&background=1B5EAE&color=fff&bold=true`}} style={{width: '100%', height: '100%', borderRadius: 24}} />
              <View style={styles.statusIndicator} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>Good Morning,</Text>
            <Text style={styles.userName}>{GlobalStore.userName || 'Employee'}</Text>
          </View>
        </Pressable>
        <Pressable 
          style={({pressed}) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          onPress={() => Alert.alert("Notifications", "You have no new alerts.")}
        >
          <Ionicons name="notifications-outline" size={24} color="#1F2937" />
          <View style={styles.notifBadge} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Welcome Banner */}
        <LinearGradient
          colors={['rgba(95, 53, 199, 0.1)', 'rgba(95, 53, 199, 0.02)']}
          style={styles.welcomeBanner}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={styles.bannerTag}>
            <Ionicons name="flash" size={14} color="#5F35C7" style={{marginRight: 4}} />
            <Text style={styles.bannerTagText}>Dashboard Overview</Text>
          </View>
          <Text style={styles.bannerTitle}>Welcome to your{'\n'}Dashboard</Text>
          <Text style={styles.bannerSubtitle}>Track cases, monitor schedule, and secure evidence directly to the vault.</Text>
        </LinearGradient>

        <View style={styles.bentoGrid}>
          
          {/* HR Quick Widget - Full Width */}
          <Pressable style={({pressed}) => [styles.bentoCard, styles.hrWidget, pressed && styles.pressedCard]}>
            <View style={styles.hrHeader}>
              <View>
                <Text style={styles.widgetTitle}>Time & Attendance</Text>
                <Text style={styles.liveClock}>{clock}</Text>
                <Text style={styles.subText}>{new Date().toDateString()}</Text>
              </View>
              <Pressable 
                style={({pressed}) => [styles.checkInBtn, pressed && styles.pressedBtn, checkInStatus.checkedIn && {backgroundColor: '#10B981', borderColor: '#10B981'}]} 
                onPress={handleCheckIn}
              >
                <Ionicons name={checkInStatus.checkedIn ? "checkmark-circle" : "finger-print"} size={18} color="#FFF" style={{marginRight: 6}} />
                <Text style={styles.checkInText}>{checkInStatus.checkedIn ? `Checked In • ${checkInStatus.time}` : 'Check In Now'}</Text>
              </Pressable>
            </View>
          </Pressable>

          <View style={styles.rowGrid}>
            {/* Task Stats Widget - Half Width */}
            <Pressable style={({pressed}) => [styles.bentoCard, styles.halfCard, pressed && styles.pressedCard]}>
              <Text style={styles.widgetTitle}>Task Overview</Text>
              <View style={styles.circularProgress}>
                <View style={styles.circleOuter}>
                  <View style={styles.circleInner}>
                    <Text style={styles.progressPercent}>{taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}<Text style={{fontSize: 14}}>%</Text></Text>
                  </View>
                </View>
              </View>
              <View style={styles.statsFooter}>
                <View style={styles.statDetail}>
                  <Text style={styles.statLabel}>Total</Text>
                  <Text style={styles.statValue}>{taskStats.total}</Text>
                </View>
                <View style={styles.statDetail}>
                  <Text style={styles.statLabel}>Done</Text>
                  <Text style={[styles.statValue, {color: '#10B981'}]}>{taskStats.completed}</Text>
                </View>
              </View>
            </Pressable>

            {/* AVR Widget - Half Width */}
            <Pressable style={({pressed}) => [styles.bentoCard, styles.halfCard, styles.avrWidget, pressed && styles.pressedCard]} onPress={openAVR}>
              <View style={styles.avrIconRing}>
                <Ionicons name="videocam" size={32} color="#FFF" />
              </View>
              <Text style={styles.avrTitle}>Live Vault</Text>
              <Text style={styles.avrSub}>Secure Sync</Text>
            </Pressable>
          </View>

          {/* Pending Cases - Full Width */}
          <View style={[styles.bentoCard, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.casesHeader}>
              <Text style={styles.widgetTitle}>Pending Cases</Text>
              <Pressable onPress={openWorkspace}><Text style={styles.seeAllText}>See All</Text></Pressable>
            </View>
            
            <FlatList
              data={casesList}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item: c, index }) => (
                <React.Fragment>
                  <Pressable style={({pressed}) => [styles.caseItem, pressed && {backgroundColor: '#F8FAFC'}]} onPress={openWorkspace}>
                    <View style={[styles.caseIcon, { backgroundColor: c.icon_color ? `${c.icon_color}25` : 'rgba(245, 158, 11, 0.15)' }]}>
                      <Ionicons name={(c.icon as any) || "home"} size={20} color={c.icon_color || "#F59E0B"} />
                    </View>
                    <View style={styles.caseInfo}>
                      <Text style={styles.caseItemTitle}>{c.title}</Text>
                      <Text style={styles.caseItemSub}>{c.case_number} • {c.status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </Pressable>
                  {index < casesList.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              )}
            />

            {casesList.length === 0 && !isLoading && (
              <View style={{padding: 20, alignItems: 'center'}}>
                <Text style={{color: '#64748B'}}>No pending cases found.</Text>
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16, backgroundColor: '#F8FAFC' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  avatarContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0', borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4 },
  statusIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFF' },
  headerInfo: { marginLeft: 12 },
  greeting: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  userName: { fontSize: 18, color: '#1F2937', fontWeight: '800' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  notifBadge: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#FFF' },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  welcomeBanner: { padding: 24, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(95, 53, 199, 0.1)' },
  bannerTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(95, 53, 199, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  bannerTagText: { color: '#5F35C7', fontSize: 12, fontWeight: '700' },
  bannerTitle: { fontSize: 26, fontWeight: '800', color: '#1F2937', marginBottom: 8, lineHeight: 32 },
  bannerSubtitle: { fontSize: 14, color: '#64748B', lineHeight: 22 },
  
  authLetterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', padding: 16, borderRadius: 20, marginBottom: 20, elevation: 6, shadowColor: '#10B981', shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.3, shadowRadius: 12 },
  authIconContainer: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  authTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  authSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' },
  
  bentoGrid: { gap: 16 },
  bentoCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 12, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.8)' },
  pressedCard: { opacity: 0.8, transform: [{scale: 0.98}] },
  
  widgetTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 12 },
  
  hrWidget: { backgroundColor: '#FFF' },
  hrHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveClock: { fontSize: 24, fontWeight: '800', color: '#1F2937', letterSpacing: 0.5, marginBottom: 4 },
  subText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  checkInBtn: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, shadowColor: '#10B981', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  checkInText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  
  rowGrid: { flexDirection: 'row', gap: 16 },
  halfCard: { flex: 1, alignItems: 'center' },
  
  circularProgress: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 8, borderColor: '#10B981', borderRightColor: 'transparent', transform: [{rotate: '-45deg'}] },
  circleOuter: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', transform: [{rotate: '45deg'}] },
  circleInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  progressPercent: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  
  statsFooter: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  statDetail: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
  
  avrWidget: { backgroundColor: '#1F2937', justifyContent: 'center', height: '100%' },
  avrIconRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  avrTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  avrSub: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  
  casesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 10 },
  seeAllText: { color: '#5F35C7', fontSize: 13, fontWeight: '700' },
  caseItem: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20 },
  caseIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  caseInfo: { flex: 1 },
  caseItemTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  caseItemSub: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 20 }
});
