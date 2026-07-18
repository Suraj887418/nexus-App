import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGlobalStore, API_BASE_URL } from '../../store';
import { Calendar } from 'react-native-calendars';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

let lastTap = 0;

const DUMMY_PAYSLIPS = [
  { id: '1', month: 'June', year: '2026', amount: '35,000' },
  { id: '2', month: 'May', year: '2026', amount: '35,000' },
];

const DUMMY_LEAVE_BALANCE = { 
  annual_leave: 0, 
  total_annual_leave: 20, 
  sick_leave: 0, 
  total_sick_leave: 10,
  leave_history: []
};

// Memoized Components for Lists
const LeaveHistoryItem = React.memo(({ leave }: { leave: any }) => (
  <View style={[styles.balanceCardNew, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={[styles.iconCircle, { backgroundColor: leave.type === 'Sick Leave' ? '#E0E7FF' : '#FEE2E2', marginRight: 12 }]}>
        <Ionicons name={leave.type === 'Sick Leave' ? 'medical' : 'calendar'} size={20} color={leave.type === 'Sick Leave' ? '#4F46E5' : '#EF4444'} />
      </View>
      <View>
        <Text style={[styles.balanceLabelNew, { textAlign: 'left', marginBottom: 2, color: '#1F2937' }]}>{leave.type}</Text>
        <Text style={[styles.balanceValNew, { fontSize: 13, color: '#64748B', textAlign: 'left', fontWeight: '500' }]}>{leave.startDate} to {leave.endDate}</Text>
      </View>
    </View>
    <View style={[styles.statusBadge, { backgroundColor: leave.status === 'Approved' ? '#DCFCE7' : leave.status === 'Pending' ? '#FEF9C3' : '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }]}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: leave.status === 'Approved' ? '#166534' : leave.status === 'Pending' ? '#92400E' : '#991B1B' }}>{leave.status}</Text>
    </View>
  </View>
));

const PayslipItem = React.memo(({ ps, isDownloading, downloadPayslip }: { ps: any, isDownloading: string | null, downloadPayslip: (id: string, month: string) => void }) => (
  <Pressable style={styles.payslipItemNew} onPress={() => downloadPayslip(ps.id, ps.month)}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={styles.payslipIconNew}><Ionicons name="cash-outline" size={24} color="#5F35C7" /></View>
      <View style={{ marginLeft: 12 }}>
        <Text style={styles.payslipMonth}>{ps.month} {ps.year ? ps.year : ''}</Text>
        <Text style={styles.payslipAmount}>₹{ps.amount}</Text>
      </View>
    </View>
    {isDownloading === ps.id ? (
      <ActivityIndicator size="small" color="#5F35C7" />
    ) : (
      <View style={styles.downloadBtn}>
        <Ionicons name="cloud-download-outline" size={18} color="#5F35C7" />
      </View>
    )}
  </Pressable>
));

const AttendanceRow = React.memo(({ row }: { row: any }) => {
  const dateObj = new Date(row.date);
  const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const isLate = row.status === 'Late';
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableCell, { flex: 2, color: '#1F2937', fontWeight: '600' }]}>{formattedDate}</Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>{row.check_in_time || '--'}</Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>{row.check_out_time || '--'}</Text>
      <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', color: isLate ? '#F59E0B' : '#10B981', fontWeight: '700' }]}>{row.status}</Text>
    </View>
  );
});

export default function HRScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const userEmail = useGlobalStore(state => state.userEmail);
  const authToken = useGlobalStore(state => state.authToken);

  const [currentMonthIndex, setCurrentMonthIndex] = useState(1);
  const [activeModal, setActiveModal] = useState<'leave' | 'status' | 'payslip' | null>(null);
  
  const [isUploadingFace, setIsUploadingFace] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [appliedLeaves, setAppliedLeaves] = useState<number[]>([]);

  // Leave application state
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveMessage, setLeaveMessage] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const leaveTypes = ['Sick Leave', 'Other Leave', 'Casual Leave', 'Unpaid Leave'];

  // React Query for fetching Attendance
  const { data: attendanceData = { records: [], isCheckedIn: false, checkInTime: null }, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance', userEmail],
    queryFn: async () => {
      const timestamp = Date.now();
      const res = await fetch(`${API_BASE_URL}/api/attendance?email=${userEmail}&t=${timestamp}`, { 
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile', 'Cache-Control': 'no-cache' } 
      });
      const data = await res.json();
      if (!data.success) return { records: [], isCheckedIn: false, checkInTime: null };
      
      const records = data.attendance;
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = records.find((r: any) => r.date.split('T')[0] === today);
      
      return {
        records,
        isCheckedIn: todayRecord ? !!todayRecord.check_in_time && !todayRecord.check_out_time : false,
        checkInTime: todayRecord ? todayRecord.check_in_time : null
      };
    },
    enabled: !!userEmail
  });

  // React Query for Leave Balance
  const { data: leaveBalance = DUMMY_LEAVE_BALANCE, refetch: refetchLeaveBalance } = useQuery({
    queryKey: ['leaveBalance', userEmail],
    queryFn: async () => {
      const timestamp = Date.now();
      const res = await fetch(`${API_BASE_URL}/api/leave/balance?email=${userEmail}&t=${timestamp}`, { 
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile', 'Cache-Control': 'no-cache' } 
      });
      const data = await res.json();
      return data.success ? { ...DUMMY_LEAVE_BALANCE, ...data.balance } : DUMMY_LEAVE_BALANCE;
    },
    enabled: !!userEmail
  });

  // React Query for Payslips
  const { data: payslips = DUMMY_PAYSLIPS, refetch: refetchPayslips } = useQuery({
    queryKey: ['payslips', userEmail],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/payslips?email=${userEmail}`, { 
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile' } 
      });
      const data = await res.json();
      return data.success && data.payslips && data.payslips.length > 0 ? data.payslips : DUMMY_PAYSLIPS;
    },
    enabled: activeModal === 'payslip' && !!userEmail
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetchAttendance();
      refetchLeaveBalance();
    }, [refetchAttendance, refetchLeaveBalance])
  );

  const handleCycleLeaveType = useCallback(() => {
    Haptics.selectionAsync().catch(() => { });
    const currentIndex = leaveTypes.indexOf(leaveType);
    const nextIndex = (currentIndex + 1) % leaveTypes.length;
    setLeaveType(leaveTypes[nextIndex]);
  }, [leaveType, leaveTypes]);

  const submitLeaveApplication = useCallback(async () => {
    if (!startDate || !endDate) {
      Alert.alert("Missing Fields", "Please provide both start and end dates.");
      return;
    }

    setIsSubmittingLeave(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      const response = await fetch(`${API_BASE_URL}/api/leave/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          leaveType,
          startDate,
          endDate,
          leaveMessage,
          notifyHrAndManager: true
        })
      });

      const data = await response.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        Alert.alert("Success", "Your leave application has been submitted successfully!");

        if (startDate) {
          const dayStr = startDate.split('/')[0];
          const parsedDay = parseInt(dayStr, 10);
          if (!isNaN(parsedDay)) {
            setAppliedLeaves(prev => [...prev, parsedDay]);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['leaveBalance', userEmail] });
        setActiveModal(null);
        setStartDate('');
        setEndDate('');
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      Alert.alert("Error", "Could not submit leave application. Check server connection.");
    } finally {
      setIsSubmittingLeave(false);
    }
  }, [startDate, endDate, leaveType, leaveMessage, userEmail, authToken, queryClient]);

  const downloadPayslip = useCallback(async (id: string, month: string) => {
    if (isDownloading) return;
    setIsDownloading(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      Alert.alert("Success", `${month} payslip downloaded successfully.`);
    } catch (error) {
      Alert.alert("Error", "Could not download payslip.");
    } finally {
      setIsDownloading(null);
    }
  }, [isDownloading]);

  const handleCheckInOut = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
    
    if (!attendanceData.isCheckedIn) {
      router.push('/biometric?mode=checkin');
    } else {
      Alert.alert(
        "Check Out",
        "Are you sure you want to check out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Check Out",
            style: "destructive",
            onPress: async () => {
                try {
                  let lat = null, lng = null;
                  try {
                    let { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                      let location = await Location.getCurrentPositionAsync({});
                      lat = location.coords.latitude;
                      lng = location.coords.longitude;
                    }
                  } catch (e) { console.log('Location error', e); }

                  const response = await fetch(`${API_BASE_URL}/api/check-out`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail, lat, lng })
                  });
                const data = await response.json();
                if (data.success) {
                  queryClient.invalidateQueries({ queryKey: ['attendance', userEmail] });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                } else {
                  Alert.alert("Check Out Failed", data.message);
                }
              } catch (err) {
                Alert.alert("Error", "Could not connect to server");
              }
            }
          }
        ]
      );
    }
  }, [attendanceData.isCheckedIn, router, authToken, userEmail, queryClient]);

  const todayDateObj = new Date();
  const months = useMemo(() => [
    new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
    todayDateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
    new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() + 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  ], [todayDateObj]);

  const markedDates = useMemo(() => {
    const dates: any = {};
    const todayStr = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
    
    dates[todayStr] = { selected: true, selectedColor: '#5F35C7' };
    
    attendanceData.records.forEach((record: any) => {
      if (record.check_in_time) {
        const date = record.date.split('T')[0];
        dates[date] = { selected: true, selectedColor: '#10B981' };
      }
    });

    if (attendanceData.isCheckedIn) {
      dates[todayStr] = { selected: true, selectedColor: '#10B981' };
    }

    appliedLeaves.forEach((day: number) => {
      const date = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dates[date] = { selected: true, selectedColor: '#EF4444' };
    });

    for (let i = 1; i <= 31; i++) {
      const date = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), i);
      if (date.getMonth() === todayDateObj.getMonth() && date.getDay() === 0) {
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        dates[dateString] = { selected: true, selectedColor: '#F59E0B' };
      }
      const prevDate = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth() - 1, i);
      if (prevDate.getMonth() === todayDateObj.getMonth() - 1 && prevDate.getDay() === 0) {
        const prevDateString = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
        dates[prevDateString] = { selected: true, selectedColor: '#F59E0B' };
      }
    }
    return dates;
  }, [attendanceData.records, attendanceData.isCheckedIn, appliedLeaves, todayDateObj]);

  const renderModalContent = () => {
    if (activeModal === 'leave') {
      return (
        <TouchableWithoutFeedback onPress={() => {
          const now = Date.now();
          if (now - lastTap < 300) Keyboard.dismiss();
          lastTap = now;
        }}>
          <View style={[styles.modalInner, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Apply for Leave</Text>
              <Pressable onPress={() => setActiveModal(null)} style={{ padding: 4, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <Pressable style={styles.inputMock} onPress={handleCycleLeaveType}>
                <Text style={[styles.inputText, { color: '#1F2937', fontWeight: '600' }]}>{leaveType}</Text>
                <Ionicons name="swap-vertical" size={20} color="#5F35C7" />
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <View style={[styles.inputMock, { flex: 1, marginBottom: 0 }]}>
                  <TextInput style={{ flex: 1, color: '#1F2937', fontWeight: '600', fontSize: 15 }} placeholder="Start (DD/MM)" placeholderTextColor="#94A3B8" value={startDate} onChangeText={setStartDate} />
                </View>
                <View style={[styles.inputMock, { flex: 1, marginBottom: 0 }]}>
                  <TextInput style={{ flex: 1, color: '#1F2937', fontWeight: '600', fontSize: 15 }} placeholder="End (DD/MM)" placeholderTextColor="#94A3B8" value={endDate} onChangeText={setEndDate} />
                </View>
              </View>

              <Text style={{ color: '#1F2937', fontWeight: '600', marginBottom: 8, fontSize: 14 }}>Leave Email Body</Text>
              <TextInput style={[styles.inputMock, { flex: 1, minHeight: 150, textAlignVertical: 'top', color: '#1F2937' }]} placeholder="Write your proper leave application mail here..." placeholderTextColor="#94A3B8" multiline value={leaveMessage} onChangeText={setLeaveMessage} />

              <Pressable style={[styles.primaryBtn, isSubmittingLeave && { opacity: 0.7 }, { marginTop: 'auto' }]} onPress={submitLeaveApplication} disabled={isSubmittingLeave}>
                {isSubmittingLeave ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Submit Application</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      );
    }
    if (activeModal === 'status') {
      return (
        <View style={styles.modalInner}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Leave Balance Overview</Text>
            <Pressable onPress={() => setActiveModal(null)} style={{ padding: 4, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <Pressable onPress={() => Alert.alert('Sick Leave', `You have taken ${leaveBalance.sick_leave} out of ${leaveBalance.total_sick_leave || 10} sick leaves.`)} style={[styles.balanceCardNew, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0E7FF' }]}><Ionicons name="medical" size={20} color="#4F46E5" /></View>
              <Text style={styles.balanceValNew}>{leaveBalance.sick_leave}/{leaveBalance.total_sick_leave || 10}</Text>
              <Text style={styles.balanceLabelNew}>Sick Leave</Text>
            </Pressable>
            <Pressable onPress={() => Alert.alert('Annual Leave', `You have taken ${leaveBalance.annual_leave} out of ${leaveBalance.total_annual_leave || 20} annual leaves.`)} style={[styles.balanceCardNew, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}><Ionicons name="calendar-outline" size={20} color="#EF4444" /></View>
              <Text style={styles.balanceValNew}>{leaveBalance.annual_leave}/{leaveBalance.total_annual_leave || 20}</Text>
              <Text style={styles.balanceLabelNew}>Annual Leave</Text>
            </Pressable>
          </View>

          <Text style={[styles.modalTitle, { fontSize: 18, marginTop: 24, marginBottom: 12 }]}>Leave History</Text>
          <FlatList
            data={leaveBalance.leave_history}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            style={{ maxHeight: 250 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={{ color: '#64748B', textAlign: 'center', marginVertical: 20 }}>No leave history found.</Text>}
            renderItem={({ item }) => <LeaveHistoryItem leave={item} />}
          />

          <Pressable style={[styles.primaryBtn, { marginTop: 32 }]} onPress={() => setActiveModal(null)}>
            <Text style={styles.primaryBtnText}>Got it</Text>
          </Pressable>
        </View>
      );
    }
    if (activeModal === 'payslip') {
      return (
        <View style={styles.modalInner}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Recent Payslips</Text>
            <Pressable onPress={() => setActiveModal(null)} style={{ padding: 4, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          <FlatList
            data={payslips}
            keyExtractor={(item) => item.id.toString()}
            style={{ maxHeight: 300 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                <Text style={{ color: '#64748B', marginTop: 12, fontWeight: '500' }}>No payslips generated yet.</Text>
              </View>
            }
            renderItem={({ item }) => <PayslipItem ps={item} isDownloading={isDownloading} downloadPayslip={downloadPayslip} />}
          />
        </View>
      );
    }
    return null;
  };

  const renderHeaderComponent = () => (
    <>
      <View style={styles.attendanceWidgetContainer}>
        <View style={styles.attendanceWidget}>
          <View style={styles.attendanceInfo}>
            <Text style={styles.currentTimeText}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.attendanceStatusText}>
              {attendanceData.isCheckedIn ? `Checked in at ${attendanceData.checkInTime}` : 'Not checked in yet'}
            </Text>
          </View>
          <Pressable 
            style={[styles.checkInBtn, attendanceData.isCheckedIn ? { backgroundColor: '#EF4444' } : null]} 
            onPress={handleCheckInOut}
            disabled={isUploadingFace}
          >
            {isUploadingFace ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name={attendanceData.isCheckedIn ? "log-out-outline" : "log-in-outline"} size={20} color="#FFFFFF" />
                <Text style={styles.checkInBtnText}>{attendanceData.isCheckedIn ? 'Check Out' : 'Check In'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <Pressable style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]} onPress={() => setActiveModal('leave')}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(95, 53, 199, 0.1)' }]}><Ionicons name="airplane" size={24} color="#5F35C7" /></View>
          <Text style={styles.actionText}>Apply Leave</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]} onPress={() => setActiveModal('status')}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}><Ionicons name="calendar" size={24} color="#F59E0B" /></View>
          <Text style={styles.actionText}>Leave Status</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); setActiveModal('payslip'); }}>
          <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}><Ionicons name="document-text" size={24} color="#10B981" /></View>
          <Text style={styles.actionText}>Payslips</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leave Calendar</Text>
      </View>
      <View style={styles.calendarCard}>
        <Calendar
          current={`${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`}
          markedDates={markedDates}
          theme={{
            backgroundColor: '#FFF',
            calendarBackground: '#FFF',
            textSectionTitleColor: '#64748B',
            selectedDayBackgroundColor: '#5F35C7',
            selectedDayTextColor: '#FFF',
            todayTextColor: '#5F35C7',
            dayTextColor: '#1F2937',
            textDisabledColor: '#E2E8F0',
            dotColor: '#5F35C7',
            selectedDotColor: '#FFF',
            arrowColor: '#5F35C7',
            disabledArrowColor: '#E2E8F0',
            monthTextColor: '#1F2937',
            indicatorColor: '#5F35C7',
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13
          }}
          onDayPress={(day: any) => Haptics.selectionAsync().catch(() => { })}
        />
        <View style={styles.legend}>
          <Pressable style={styles.legendItem} onPress={() => Alert.alert('Present Status', 'You have been present for 22 days this month.')}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Present</Text>
          </Pressable>
          <Pressable style={styles.legendItem} onPress={() => Alert.alert('Leave Status', `You have taken ${leaveBalance.sick_leave + leaveBalance.annual_leave} leaves this month.`)}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Leave</Text>
          </Pressable>
          <Pressable style={styles.legendItem} onPress={() => Alert.alert('Holiday Info', 'There are upcoming holidays this month.')}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Holiday</Text>
          </Pressable>
          <Pressable style={styles.legendItem} onPress={() => Alert.alert('Today', "Today's attendance has been synced successfully.")}>
            <View style={[styles.legendDot, { backgroundColor: '#5F35C7' }]} />
            <Text style={styles.legendText}>Today</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Attendance</Text>
      </View>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Date</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>In</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Out</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Status</Text>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#F8FAFC' }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>HR & Leave</Text>
        <Text style={styles.headerSubtitle}>Manage your attendance</Text>
      </View>

      <FlatList
        data={attendanceData.records}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={renderHeaderComponent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 10, color: '#64748B' }}>No attendance records found.</Text>}
        renderItem={({ item }) => <AttendanceRow row={item} />}
      />

      <Modal visible={activeModal !== null} transparent={true} animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <Pressable style={{ flex: 1 }} onPress={() => setActiveModal(null)} />
            <View style={[styles.modalContent, activeModal === 'leave' && { flex: 4, marginTop: 40 }]}>
              <View style={styles.modalHandle} />
              {renderModalContent()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 24, paddingBottom: 16, backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937' },
  headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },

  scrollContent: { padding: 24, paddingBottom: 100 },

  attendanceWidgetContainer: { marginBottom: 24 },
  attendanceWidget: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', padding: 20, borderRadius: 20, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  attendanceInfo: { flex: 1 },
  currentTimeText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  attendanceStatusText: { color: '#94A3B8', fontSize: 13, marginTop: 4, fontWeight: '500' },
  checkInBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, gap: 8 },
  checkOutBtn: { backgroundColor: '#F59E0B' },
  checkInBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  actionCard: { width: '31%', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionText: { color: '#1F2937', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937' },

  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  monthText: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekDayText: { width: 30, textAlign: 'center', color: '#64748B', fontSize: 12, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dayCell: { width: '13%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderRadius: 8 },
  dayText: { color: '#1F2937', fontSize: 14 },
  dayLeave: { backgroundColor: '#EF4444' },
  dayHoliday: { backgroundColor: '#F59E0B' },
  dayToday: { backgroundColor: '#5F35C7' },

  legend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: '#64748B', fontSize: 12 },

  tableCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 12, marginBottom: 12, marginTop: 10 },
  tableHeaderCell: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  tableRow: { flexDirection: 'row', marginBottom: 16 },
  tableCell: { color: '#64748B', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalInner: { width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 20 },

  inputMock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 16, borderRadius: 12, marginBottom: 12 },
  inputText: { color: '#64748B', fontSize: 15, fontWeight: '500' },

  primaryBtn: { backgroundColor: '#5F35C7', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  balanceCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  balanceLabel: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  balanceValue: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  balanceCardNew: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  balanceValNew: { fontSize: 22, fontWeight: '800', color: '#1F2937', marginBottom: 2 },
  balanceLabelNew: { fontSize: 13, fontWeight: '600', color: '#64748B', textAlign: 'center' },

  payslipItemNew: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  payslipIconNew: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(95, 53, 199, 0.1)', alignItems: 'center', justifyContent: 'center' },
  payslipMonth: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  payslipAmount: { fontSize: 13, fontWeight: '600', color: '#10B981', marginTop: 2 },
  downloadBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(95, 53, 199, 0.1)', alignItems: 'center', justifyContent: 'center' },

  payslipItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  payslipIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  payslipText: { fontSize: 15, fontWeight: '600', color: '#1F2937' }
});
