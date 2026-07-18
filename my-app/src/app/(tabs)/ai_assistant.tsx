import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Animated, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useGlobalStore, API_BASE_URL } from '../../store';
import { LinearGradient } from 'expo-linear-gradient';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
}

export default function AiAssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "Hello! I am Nexus AI. How can I help you today?", isBot: true }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  
  const userEmail = useGlobalStore(state => state.userEmail);
  const userName = useGlobalStore(state => state.userName);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const userMsg: Message = { id: Date.now().toString(), text: input.trim(), isBot: false };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text, email: userEmail })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, { id: Date.now().toString(), text: data.reply, isBot: true }]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Sorry, I'm having trouble connecting to the server.", isBot: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          style={({pressed}) => [styles.backBtn, pressed && {opacity: 0.7}]} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.back();
          }}
        >
          <Ionicons name="chevron-back" size={28} color="#1F2937" />
        </Pressable>
        <View style={styles.headerIconContainer}>
          <Ionicons name="sparkles" size={24} color="#FFF" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Nexus AI</Text>
          <Text style={styles.headerSubtitle}>Always here to help, {userName || 'Employee'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubble, msg.isBot ? styles.botBubble : styles.userBubble]}>
              <Text style={msg.isBot ? styles.botMessageText : styles.userMessageText}>{msg.text}</Text>
            </View>
          ))}
          {isLoading && (
            <View style={[styles.messageBubble, styles.botBubble, { width: 60, alignItems: 'center' }]}>
              <ActivityIndicator color="#5F35C7" size="small" />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask me anything..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <Pressable 
            style={({pressed}) => [styles.sendBtn, pressed && { opacity: 0.8 }, !input.trim() && { backgroundColor: '#E2E8F0' }]} 
            onPress={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color={input.trim() ? "#FFF" : "#94A3B8"} style={{marginLeft: 4}} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { marginRight: 12, padding: 4 },
  headerIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#5F35C7', justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: '#5F35C7', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  
  chatContainer: { padding: 20, paddingBottom: 40 },
  messageBubble: { maxWidth: '85%', padding: 16, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  botBubble: { backgroundColor: '#FFF', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: '#5F35C7', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  
  botMessageText: { color: '#1F2937', fontSize: 15, lineHeight: 22 },
  userMessageText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  
  inputContainer: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontSize: 16, color: '#1F2937', maxHeight: 120 },
  sendBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#5F35C7', justifyContent: 'center', alignItems: 'center', marginLeft: 12, shadowColor: '#5F35C7', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
});
