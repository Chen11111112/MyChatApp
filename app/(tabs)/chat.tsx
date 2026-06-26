import { router, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase'; // 如果有紅線請改為 '../firebase'

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: any;
  isRead?: boolean; // 👈 擴充未讀狀態欄位
}

export default function ChatScreen() {
  const { id: roomId, chatWith } = useLocalSearchParams<{ id: string; chatWith: string }>();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // 模擬當前登入者 ID (王小明)
  const currentUserId = 'my_user_id_123'; 

  useEffect(() => {
    if (!roomId) return;

    // 【即時監聽 + 雲端排序】滿足第 11 項加分要求！
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

      // 🌟 【未讀功能核心邏輯】當收到新訊息時，把「別人發給我、且目前還是未讀」的訊息通通改成已讀
      const batch = writeBatch(db);
      let hasUpdates = false;

      snapshot.docs.forEach((document) => {
        const data = document.data();
        // 條件：是這個房間的訊息 + 發送者不是我 + 目前 isRead 是 false (或不存在)
        if (data.senderId !== currentUserId && data.isRead !== true) {
          const msgRef = doc(db, 'messages', document.id);
          batch.update(msgRef, { isRead: true });
          hasUpdates = true;
        }
      });

      // 如果有需要更新的未讀訊息，一次打包送給 Firebase 更新
      if (hasUpdates) {
        batch.commit().catch((err) => console.error("更新已讀狀態失敗:", err));
      }

    }, (error) => {
      console.error("Firebase 監聽失敗（請確保索引已建立完畢）:", error.message);
    });

    return () => unsubscribe();
  }, [roomId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const newMessageText = inputText.trim();
    setInputText(''); // 按下傳送時立即清空輸入框

    try {
      // 🌟 傳送新訊息時，附帶 isRead: false，讓接收方知道這是未讀訊息
      await addDoc(collection(db, 'messages'), {
        roomId: roomId,
        senderId: currentUserId,
        text: newMessageText,
        createdAt: serverTimestamp(),
        isRead: false // 👈 預設為未讀
      });
    } catch (error) {
      console.error('發送失敗: ', error);
    }
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    try {
      let date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt.seconds * 1000);
      if (isNaN(date.getTime())) return '';
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/two')}>
          <Text style={styles.backButton}>〈 返回列表</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{chatWith || '聊天室'}</Text>
        <View style={{ width: 70 }} />
      </View>

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

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="輸入訊息..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
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