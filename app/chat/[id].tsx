import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase'; // 確保能找到根目錄的 firebase.js

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export default function ChatScreen() {
  // 從網址路徑取得 id (也就是 roomId) 與名字參數
  const { id: roomId, chatWith } = useLocalSearchParams<{ id: string; chatWith: string }>();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // 模擬目前登入者 ID
  const currentUserId = 'my_user_id_123'; 

  // 即時監聽 Firestore 訊息變化
  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, 'messages'),
      where('roomId', '==', roomId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Message, 'id'>)
      }));
      setMessages(msgList);
    }, (error) => {
      console.error("Firestore 監聽失敗，請確認是否建立了索引:", error);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 發送訊息
  const handleSend = async () => {
    if (!inputText.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        roomId: roomId,
        senderId: currentUserId,
        text: inputText.trim(),
        createdAt: serverTimestamp() // 作業要求使用 serverTimestamp()
      });
      setInputText(''); // 清空輸入框
    } catch (error) {
      console.error('發送訊息失敗: ', error);
    }
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      {/* 頂部導覽列 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/two')}>
          <Text style={styles.backButton}>〈 返回列表</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{chatWith || '聊天室'}</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* 訊息對話列表 */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMe = item.senderId === currentUserId;
          return (
            <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
              <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                <Text style={isMe ? styles.myText : styles.otherText}>{item.text}</Text>
              </View>
              <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            </View>
          );
        }}
      />

      {/* 底部輸入框區域 */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="輸入訊息..."
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>傳送</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingHorizontal: 15 },
  backButton: { fontSize: 16, color: '#007AFF' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  messageList: { padding: 15 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 8, maxWidth: '80%' },
  myRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  otherRow: { alignSelf: 'flex-start' },
  messageBubble: { padding: 10, borderRadius: 15, marginHorizontal: 5 },
  myBubble: { backgroundColor: '#007AFF' },
  otherBubble: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  myText: { color: '#fff', fontSize: 16 },
  otherText: { color: '#333', fontSize: 16 },
  timeText: { fontSize: 11, color: '#999', marginHorizontal: 2 },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
  input: { flex: 1, height: 40, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 15, backgroundColor: '#fafafa', marginRight: 10 },
  sendButton: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  sendButtonText: { color: '#fff', fontWeight: 'bold' },
});