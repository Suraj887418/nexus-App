import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GlobalStore, API_BASE_URL } from '../store';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    
    if (password.length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      setIsLoading(false);

      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        GlobalStore.setUserEmail(data.user?.email || email);
        GlobalStore.setUserName(data.user?.name || 'Employee');
        if (data.token) {
           GlobalStore.setAuthToken(data.token);
        }
        GlobalStore.setFaceVerified(true);
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials.");
      }
    } catch (error) {
      setIsLoading(false);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      Alert.alert("Connection Error", "Ensure your backend server is running on localhost:3000.");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="dark" />
      
      {/* Decorative Gradient Blob */}
      <LinearGradient
        colors={['#5F35C7', 'rgba(95, 53, 199, 0.12)']}
        style={styles.blobTop}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
        </View>

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Enter your details to sign in to your account.</Text>

        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={[styles.inputWrapper, email.length > 0 && styles.inputWrapperActive]}>
             <Ionicons name="mail-outline" size={20} color={email.length > 0 ? "#5F35C7" : "#94A3B8"} style={{marginRight: 12}} />
             <TextInput 
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
             />
             {email.includes('@') && (
               <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{marginLeft: 'auto'}} />
             )}
          </View>
          
          <Text style={[styles.inputLabel, {marginTop: 16}]}>Password</Text>
          <View style={[styles.inputWrapper, password.length > 0 && styles.inputWrapperActive]}>
             <Ionicons name="lock-closed-outline" size={20} color={password.length > 0 ? "#5F35C7" : "#94A3B8"} style={{marginRight: 12}} />
             <TextInput 
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
             />
             <Pressable onPress={() => setShowPassword(!showPassword)} style={{marginLeft: 'auto'}}>
               <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#64748B" />
             </Pressable>
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale }], width: '100%' }}>
          <Pressable 
            style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.9 }]} 
            onPress={handleLogin}
            disabled={isLoading || password.length < 6 || !email.includes('@')}
          >
            <LinearGradient
              colors={(password.length >= 6 && email.includes('@')) ? ['#5F35C7', '#4B27A8'] : ['#94A3B8', '#64748B']}
              style={styles.loginBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                  <Ionicons name="log-in-outline" size={24} color="#FFF" style={{marginLeft: 8}} />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <Link href="/signup" asChild>
            <Pressable>
              <Text style={styles.signupLink}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>

      </View>
      </ScrollView>

      <Text style={styles.footerText}>Secure Login Process</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  blobTop: { position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200 },
  content: { paddingHorizontal: 32, alignItems: 'center' },
  
  logoContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E3EEFF', justifyContent: 'center', alignItems: 'center', marginBottom: 24, elevation: 10, shadowColor: '#5F35C7', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.2, shadowRadius: 20, overflow: 'hidden' },
  
  title: { fontSize: 32, fontWeight: '900', color: '#1F2937', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748B', fontWeight: '500', marginBottom: 40, textAlign: 'center', lineHeight: 22 },
  
  formContainer: { width: '100%', marginBottom: 32 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: '#F1F5F9' },
  inputWrapperActive: { borderColor: '#5F35C7', backgroundColor: '#F0F5FA' },
  
  input: { flex: 1, fontSize: 16, color: '#1F2937', fontWeight: '600', paddingVertical: 12 },
  
  loginBtn: { width: '100%', borderRadius: 16, elevation: 8, shadowColor: '#5F35C7', shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.3, shadowRadius: 12 },
  loginBtnGradient: { paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  
  signupContainer: { flexDirection: 'row', marginTop: 24 },
  signupText: { fontSize: 15, color: '#64748B', fontWeight: '500' },
  signupLink: { fontSize: 15, color: '#5F35C7', fontWeight: '700' },
  
  footerText: { position: 'absolute', bottom: 40, width: '100%', textAlign: 'center', color: '#94A3B8', fontSize: 13, fontWeight: '500' }
});
