import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert, Dimensions, Modal, Linking, ActivityIndicator, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';

import { useGlobalStore, API_BASE_URL } from '../../store';

const { width } = Dimensions.get('window');

// 1. Memoized CaseCard Component
const CaseCard = React.memo(({ 
  item, 
  handleAuthLetter, 
  submitAssignAction, 
  openWorkspace 
}: { 
  item: any, 
  handleAuthLetter: () => void, 
  submitAssignAction: (id: string, action: 'Accepted' | 'Rejected') => void, 
  openWorkspace: (id: string) => void 
}) => {
  return (
    <View style={styles.caseCard}>
      <View style={styles.caseDetailsRow}>
        <View style={[styles.caseIcon, { backgroundColor: item.icon_color ? 'rgba(95, 53, 199, 0.1)' : 'rgba(59, 130, 246, 0.2)' }]}>
          <Ionicons name={(item.icon as any) || "folder-open"} size={20} color={item.icon_color || "#3B82F6"} />
        </View>
        <View style={styles.caseDetails}>
          <Text style={styles.caseTitle}>{item.title}</Text>
          <Text style={styles.caseSub}>{item.case_number}</Text>
        </View>
        {item.status !== 'Pending' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
        )}
      </View>

      {item.status === 'Pending' ? (
        <Pressable 
          style={({pressed}) => [styles.authLetterBtn, { marginTop: 12, borderRadius: 12 }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]} 
          onPress={() => {
            handleAuthLetter();
            setTimeout(() => submitAssignAction(item.case_number, 'Accepted'), 1000);
          }}
        >
          <View style={[styles.authIconContainer, { width: 36, height: 36, borderRadius: 10 }]}>
            <Ionicons name="document-text" size={20} color="#FFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.authTitle, { fontSize: 14 }]}>Authorization Letter</Text>
            <Text style={[styles.authSubtitle, { fontSize: 11 }]}>Show digital ID for field verification</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFF" />
        </Pressable>
      ) : (
        <Pressable style={styles.workspaceBtn} onPress={() => openWorkspace(item.case_number)}>
          <Text style={styles.workspaceBtnText}>Open Workspace</Text>
        </Pressable>
      )}
    </View>
  );
});


export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const userEmail = useGlobalStore(state => state.userEmail);
  const authToken = useGlobalStore(state => state.authToken);
  const isFaceVerified = useGlobalStore(state => state.isFaceVerified);
  const userName = useGlobalStore(state => state.userName);

  const [activeFilter, setActiveFilter] = useState<'Pending' | 'Accepted' | 'Rejected' | 'Total'>('Pending');
  
  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-width)).current;

  // Assigned Cases Modal State
  const [isAssignListModalVisible, setIsAssignListModalVisible] = useState(false);

  // Road Map Modal state
  const [isRoadMapModalVisible, setIsRoadMapModalVisible] = useState(false);

  React.useEffect(() => {
    if (!isFaceVerified) {
      router.replace('/');
    }
  }, [isFaceVerified, router]);

  const { data: allCases = [], isLoading, refetch } = useQuery({
    queryKey: ['cases', userEmail],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/cases?email=${userEmail}`, { 
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile' } 
      });
      const data = await response.json();
      return data.success ? data.cases : [];
    },
    enabled: isFaceVerified && !!userEmail,
  });

  useFocusEffect(
    useCallback(() => {
      if (isFaceVerified) {
        refetch();
      }
    }, [isFaceVerified, refetch])
  );

  const stats = useMemo(() => {
    let pending = 0, accepted = 0, rejected = 0;
    allCases.forEach((c: any) => {
      if (c.status === 'Pending') pending++;
      else if (c.status === 'Accepted') accepted++;
      else if (c.status === 'Rejected') rejected++;
    });
    return { pending, accepted, rejected, total: allCases.length };
  }, [allCases]);

  const displayedCases = useMemo(() => {
    return activeFilter === 'Total' ? allCases : allCases.filter((c: any) => c.status === activeFilter);
  }, [allCases, activeFilter]);

  const pendingCases = useMemo(() => {
    return allCases.filter((c: any) => c.status === 'Pending');
  }, [allCases]);

  const toggleDrawer = useCallback(() => {
    if (isDrawerOpen) {
      Animated.timing(drawerAnim, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => setIsDrawerOpen(false));
    } else {
      setIsDrawerOpen(true);
      Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [isDrawerOpen, drawerAnim]);

  const handleProfilePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/(tabs)/profile');
  }, [router]);

  const handleAssignCase = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsAssignListModalVisible(true);
  }, []);

  const submitAssignAction = useCallback(async (caseId: string, action: 'Accepted' | 'Rejected') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/cases/status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail || 'employee@company.com',
          caseNumber: caseId,
          status: action
        })
      });
      const data = await response.json();
      
      if (data.success) {
        Haptics.notificationAsync(
          action === 'Accepted' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
        ).catch(() => {});
        Alert.alert("Success", `${action} successfully and updated database!`, [
          { 
            text: "OK", 
            onPress: () => {
              queryClient.invalidateQueries({ queryKey: ['cases', userEmail] });
              if (action === 'Accepted') {
                router.push({ pathname: '/(tabs)/workspace', params: { caseId } });
              }
            }
          }
        ]);
      } else {
        throw new Error(data.message);
      }
    } catch(err) {
      Alert.alert('Error', 'Could not update case status. Is backend running?');
    }
  }, [authToken, userEmail, queryClient, router]);

  const handleAuthLetter = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert("Authorization Letter", "Your digital authorization letter is ready for verification.");
  }, []);

  const openRoadMap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsRoadMapModalVisible(true);
  }, []);

  const closeRoadMapModal = useCallback(() => {
    setIsRoadMapModalVisible(false);
  }, []);

  const openWorkspace = useCallback((caseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: '/(tabs)/workspace', params: { caseId } });
  }, [router]);

  const renderHeader = () => (
    <View>
      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <Pressable 
          style={({pressed}) => [styles.primaryActionBtn, pressed && styles.primaryActionBtnPressed]} 
          onPress={handleAssignCase}
        >
          <Ionicons name="briefcase" size={32} color="#FFF" style={{marginBottom: 8}} />
          <Text style={styles.primaryActionText}>Assign Case</Text>
        </Pressable>

        <Pressable 
          style={({pressed}) => [styles.secondaryActionBtn, pressed && styles.secondaryActionBtnPressed]} 
          onPress={openRoadMap}
        >
          <Ionicons name="map" size={32} color="#5F35C7" style={{marginBottom: 8}} />
          <Text style={styles.secondaryActionText}>Road Map</Text>
        </Pressable>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <Pressable style={[styles.statCard, activeFilter === 'Pending' && styles.statCardActive]} onPress={() => setActiveFilter('Pending')}>
          <Text style={[styles.statNumber, activeFilter === 'Pending' && styles.statNumberActive]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, activeFilter === 'Pending' && styles.statLabelActive]}>Pending</Text>
        </Pressable>
        <Pressable style={[styles.statCard, activeFilter === 'Accepted' && styles.statCardActive]} onPress={() => setActiveFilter('Accepted')}>
          <Text style={[styles.statNumber, activeFilter === 'Accepted' && styles.statNumberActive]}>{stats.accepted}</Text>
          <Text style={[styles.statLabel, activeFilter === 'Accepted' && styles.statLabelActive]}>Accepted</Text>
        </Pressable>
        <Pressable style={[styles.statCard, activeFilter === 'Rejected' && styles.statCardActive]} onPress={() => setActiveFilter('Rejected')}>
          <Text style={[styles.statNumber, activeFilter === 'Rejected' && styles.statNumberActive]}>{stats.rejected}</Text>
          <Text style={[styles.statLabel, activeFilter === 'Rejected' && styles.statLabelActive]}>Rejected</Text>
        </Pressable>
        <Pressable style={[styles.statCard, activeFilter === 'Total' && styles.statCardActive]} onPress={() => setActiveFilter('Total')}>
          <Text style={[styles.statNumber, activeFilter === 'Total' && styles.statNumberActive]}>{stats.total}</Text>
          <Text style={[styles.statLabel, activeFilter === 'Total' && styles.statLabelActive]}>Total</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Here your {activeFilter.toLowerCase()} cases</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F8FAFC' }} />

      <View style={styles.header}>
        <Pressable style={styles.menuBtn} onPress={toggleDrawer}>
          <Ionicons name="menu" size={28} color="#1F2937" />
        </Pressable>
        <View style={styles.profileRow}>
          <Pressable 
            style={({pressed}) => [{flexDirection: 'row', alignItems: 'center', flex: 1}, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            onPress={handleProfilePress}
          >
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={32} color="#64748B" />
              <View style={styles.statusIndicator} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.greeting}>Welcome,</Text>
              <Text style={styles.userName}>{userName || 'Employee'}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#5F35C7" style={{ marginTop: 30, marginBottom: 30 }} />
      ) : (
        <FlatList
          data={displayedCases}
          keyExtractor={(item) => item?.case_number?.toString() || item?._id?.toString() || Math.random().toString()}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{marginLeft: 24, color: '#64748B'}}>No {activeFilter.toLowerCase()} cases assigned.</Text>}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <CaseCard 
                item={item} 
                handleAuthLetter={handleAuthLetter}
                submitAssignAction={submitAssignAction}
                openWorkspace={openWorkspace}
              />
            </View>
          )}
        />
      )}

      {/* Assign Cases List Modal */}
      <Modal
        visible={isAssignListModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsAssignListModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 15, paddingBottom: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginTop: 30 }}>
            <View style={{ width: 40 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'center' }}>Assigned Cases</Text>
            <Pressable 
              onPress={() => setIsAssignListModalVisible(false)}
              style={({pressed}) => [{ width: 40, alignItems: 'flex-end' }, pressed && { opacity: 0.5 }]}
            >
              <View style={{ backgroundColor: '#FEE2E2', padding: 6, borderRadius: 20 }}>
                <Ionicons name="close" size={22} color="#EF4444" />
              </View>
            </Pressable>
          </View>

          <FlatList
            data={pendingCases}
            keyExtractor={(item) => item?.case_number?.toString() || item?._id?.toString() || Math.random().toString()}
            style={{ flex: 1, paddingHorizontal: 20, paddingTop: 15 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.modalSubtitle}>No assigned cases currently available.</Text>}
            renderItem={({ item, index }) => (
              <Pressable 
                style={({pressed}) => [styles.assignListCard, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
                onPress={() => {
                  setIsAssignListModalVisible(false);
                  openWorkspace(item.case_number);
                }}
              >
                <View style={styles.assignListRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignListLabel}>Claim No.</Text>
                    <Text style={styles.assignListValue}>{item.case_number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignListLabel}>TAT</Text>
                    <Text style={styles.assignListValue}>{(index + 2)} Hrs</Text>
                  </View>
                </View>
                
                <View style={styles.assignListRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignListLabel}>Hospital</Text>
                    <Text style={styles.assignListValue} numberOfLines={2}>{item.hospital_name || 'N/A'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignListLabel}>Type</Text>
                    <View style={styles.typeBadge}>
                      <Text style={[styles.typeBadgeText, { color: index % 2 === 0 ? '#10B981' : '#3B82F6' }]}>
                        {index % 2 === 0 ? 'Cashless' : 'Reimbursement'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Road Map Modal */}
      <Modal
        visible={isRoadMapModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeRoadMapModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Road Map Tracking</Text>
              <Pressable onPress={closeRoadMapModal}>
                <Ionicons name="close-circle" size={28} color="#94A3B8" />
              </Pressable>
            </View>

            <FlatList
              data={allCases}
              keyExtractor={(item) => item?.case_number?.toString() || item?._id?.toString() || Math.random().toString()}
              style={{ maxHeight: 350 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.modalSubtitle}>No assigned cases found for navigation.</Text>}
              renderItem={({ item, index }) => (
                <View style={styles.roadMapCard}>
                  <View style={styles.roadMapHeader}>
                    <View style={[styles.caseIcon, { backgroundColor: item.icon_color ? 'rgba(95, 53, 199, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <Text style={{ color: item.icon_color || "#10B981", fontWeight: 'bold' }}>{index + 1}</Text>
                    </View>
                    <View style={styles.roadMapDetails}>
                      <Text style={styles.roadMapHospital}>{item.hospital_name || 'Unknown Hospital'}</Text>
                      <Text style={styles.roadMapPatient}>Patient: {item.patient_name || 'N/A'}</Text>
                      <Text style={styles.roadMapAddress} numberOfLines={2}>{item.hospital_address || 'Address not available'}</Text>
                    </View>
                  </View>
                </View>
              )}
            />
            
            {allCases.length > 0 && (
              <Pressable 
                style={[styles.navigateBtn, { marginTop: 16 }]} 
                onPress={() => {
                  const waypoints = allCases.slice(0, -1).map((item: any) => encodeURIComponent(`${item.hospital_name} ${item.hospital_address}`)).join('|');
                  const destination = allCases[allCases.length - 1];
                  const destinationQuery = encodeURIComponent(`${destination.hospital_name} ${destination.hospital_address}`);
                  
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}${waypoints ? `&waypoints=${waypoints}` : ''}`;
                  
                  Linking.openURL(url).catch(err => {
                    Alert.alert("Error", "Could not open Google Maps.");
                  });
                }}
              >
                <Ionicons name="map" size={20} color="#FFF" style={{marginRight: 8}} />
                <Text style={styles.navigateBtnText}>Navigate to All Hospitals</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Custom Sidebar Drawer */}
      {isDrawerOpen && (
        <Pressable style={styles.drawerOverlay} onPress={toggleDrawer}>
          <Pressable style={{flex: 1}} onPress={(e) => e.stopPropagation()}>
            <Animated.View style={[styles.drawerContent, { transform: [{ translateX: drawerAnim }] }]}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerLogo}>
                  <Image source={require('../../../assets/images/logo.png')} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                </View>
                <View>
                  <Text style={styles.drawerTitle}>Nexus Corp</Text>
                  <Text style={styles.drawerSubtitle}>Solutions</Text>
                </View>
                <Pressable style={{marginLeft: 'auto', padding: 4}} onPress={toggleDrawer}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView style={styles.drawerNav}>
                <Pressable style={styles.drawerNavItem} onPress={() => { toggleDrawer(); router.push('/full_dashboard'); }}>
                  <Ionicons name="apps" size={22} color="#64748B" />
                  <Text style={styles.drawerNavText}>Full Dashboard</Text>
                </Pressable>
                
                <Pressable style={[styles.drawerNavItem, styles.drawerNavItemActive]} onPress={() => { toggleDrawer(); }}>
                  <Ionicons name="home" size={22} color="#5F35C7" />
                  <Text style={[styles.drawerNavText, styles.drawerNavTextActive]}>Home</Text>
                </Pressable>

                <Pressable style={styles.drawerNavItem} onPress={() => { toggleDrawer(); openWorkspace('nav'); }}>
                  <Ionicons name="briefcase" size={22} color="#64748B" />
                  <Text style={styles.drawerNavText}>Cases</Text>
                </Pressable>
                
                <Pressable style={styles.drawerNavItem} onPress={() => { toggleDrawer(); handleProfilePress(); }}>
                  <Ionicons name="person-circle" size={22} color="#64748B" />
                  <Text style={styles.drawerNavText}>Profile</Text>
                </Pressable>
              </ScrollView>

              <Pressable style={styles.drawerLogout} onPress={() => { toggleDrawer(); router.replace('/'); }}>
                <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                <Text style={styles.drawerLogoutText}>Logout</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, backgroundColor: '#F8FAFC' },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#3B82F6', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4 },
  statusIndicator: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#F8FAFC' },
  headerInfo: { flex: 1, marginLeft: 12 },
  greeting: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  userName: { fontSize: 18, color: '#1F2937', fontWeight: '800' },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, marginTop: 10 },
  primaryActionBtn: { flex: 1, backgroundColor: '#5F35C7', borderRadius: 24, padding: 24, alignItems: 'center', justifyContent: 'center', marginRight: 8, elevation: 6, shadowColor: '#5F35C7', shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.3, shadowRadius: 12 },
  primaryActionBtnPressed: { backgroundColor: '#4B27A8', transform: [{ scale: 0.96 }] },
  primaryActionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  secondaryActionBtn: { flex: 1, backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', justifyContent: 'center', marginLeft: 8, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8 },
  secondaryActionBtnPressed: { backgroundColor: '#F8FAFC', transform: [{ scale: 0.96 }] },
  secondaryActionText: { color: '#5F35C7', fontSize: 16, fontWeight: '800' },
  
  authLetterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', padding: 16, borderRadius: 20, marginBottom: 24, elevation: 6, shadowColor: '#10B981', shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.3, shadowRadius: 12 },
  authIconContainer: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  authTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  authSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' },
  
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1F2937', marginBottom: 16, marginLeft: 4 },
  
  casesContainer: { marginBottom: 20 },
  caseCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.02, shadowRadius: 8 },
  caseDetailsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  caseIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  caseDetails: { flex: 1 },
  caseTitle: { fontSize: 15, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  caseSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  
  statusBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  workspaceBtn: { backgroundColor: '#F8FAFC', paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 8 },
  workspaceBtnText: { color: '#5F35C7', fontSize: 14, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.1, shadowRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1F2937' },
  modalSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 16, lineHeight: 20, textAlign: 'center' },
  
  assignListCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 8 },
  assignListRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  assignListLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  assignListValue: { fontSize: 14, color: '#1F2937', fontWeight: '800' },
  typeBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },

  roadMapCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  roadMapHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  roadMapDetails: { flex: 1 },
  roadMapHospital: { fontSize: 15, fontWeight: '800', color: '#1F2937', marginBottom: 2 },
  roadMapPatient: { fontSize: 13, fontWeight: '600', color: '#5F35C7', marginBottom: 4 },
  roadMapAddress: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  
  navigateBtn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  navigateBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 },
  drawerContent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: width * 0.75, backgroundColor: '#F8FAFC', padding: 24, paddingVertical: 40, zIndex: 101, borderTopRightRadius: 30, borderBottomRightRadius: 30, shadowColor: '#000', shadowOffset: {width: 4, height: 0}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 40 },
  drawerLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#5F35C7', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  drawerTitle: { fontSize: 18, fontWeight: '900', color: '#1F2937' },
  drawerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  
  drawerNav: { flex: 1 },
  drawerNavItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  drawerNavItemActive: { backgroundColor: 'rgba(95, 53, 199, 0.1)' },
  drawerNavText: { marginLeft: 16, fontSize: 16, fontWeight: '700', color: '#64748B' },
  drawerNavTextActive: { color: '#5F35C7' },
  
  drawerLogout: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, marginTop: 20 },
  drawerLogoutText: { marginLeft: 12, fontSize: 16, fontWeight: '800', color: '#EF4444' },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, marginTop: -10 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8 },
  statCardActive: { backgroundColor: '#5F35C7', borderColor: '#5F35C7' },
  statNumber: { fontSize: 22, fontWeight: '900', color: '#5F35C7', marginBottom: 4 },
  statNumberActive: { color: '#FFF' },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  statLabelActive: { color: 'rgba(255, 255, 255, 0.9)' }
});
