import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { GlobalStore, API_BASE_URL } from '../../store';

export default function TabLayout() {
  const sosScale = useRef(new Animated.Value(1)).current;
  const [isSendingSOS, setIsSendingSOS] = useState(false);

  const handleSOS = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    Animated.sequence([
      Animated.timing(sosScale, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      Animated.timing(sosScale, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(sosScale, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();

    if (isSendingSOS) return;
    setIsSendingSOS(true);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsSendingSOS(false);
        Alert.alert('Permission Denied', 'We need location access to send your exact coordinates in an emergency.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      
      const response = await fetch(`${API_BASE_URL}/api/sos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GlobalStore.authToken}`, 'x-app-source': 'mobile', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: GlobalStore.userEmail || 'unknown@user.com',
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        })
      });

      const data = await response.json();
      setIsSendingSOS(false);

      if (data.success) {
        Alert.alert("EMERGENCY SOS", "Distress signal and your live location have been successfully transmitted to HQ.", [{ text: "Understood" }]);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setIsSendingSOS(false);
      Alert.alert("SOS FAILED", "Network error. Please try calling emergency services directly!");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#5F35C7',
          tabBarInactiveTintColor: '#64748B',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            elevation: 10,
            shadowColor: '#000',
            height: 65,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
            marginTop: 4,
          }
        }}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="workspace"
          options={{
            title: 'Workspace',
            tabBarIcon: ({ color }) => <Ionicons name="briefcase" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="avr"
          options={{
            title: 'AVR',
            tabBarIcon: ({ color }) => <Ionicons name="videocam" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="hr"
          options={{
            title: 'Leave',
            tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="mrd"
          options={{
            title: 'MRD',
            tabBarIcon: ({ color }) => <Ionicons name="receipt" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ai_assistant"
          options={{
            title: 'AI Bot',
            tabBarIcon: ({ color }) => <Ionicons name="sparkles" size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={26} color={color} />,
          }}
        />
      </Tabs>

      {/* Persistent SOS Floating Action Button */}
      <Animated.View style={[styles.sosContainer, { transform: [{ scale: sosScale }] }]}>
        <TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.8} disabled={isSendingSOS}>
          {isSendingSOS ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Ionicons name="warning" size={28} color="#FFF" />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sosContainer: {
    position: 'absolute',
    bottom: 85, // Above the tab bar
    right: 20,
    zIndex: 1000,
  },
  sosButton: {
    backgroundColor: '#EF4444', // Red
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  }
});
