import { router } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase'; // 確保路徑指向你的 firebase.ts

// 定義好友/聊天室的資料結構
interface ChatRoom {
  id: string;        // 房間 ID (roomId)
  name: string;      // 好友名字
  lastMessage: string; // 最後一筆訊息內容
  lastTime: string;   // 最後一筆訊息時間
  unreadCount: number; // 🌟 新增：該房間的未讀訊息總數
}

export default function TabTwoScreen() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);

  // 模擬當前登入者 ID（必須跟 chat.tsx 裡的一致，這樣才知道是誰沒讀）
  const currentUserId = 'my_user_id_123'; 

  // 定義預設的好友清單與房間對應 (符合第 4, 5 項：可透過帳號或 ID 互加)
  const DEFAULT_FRIENDS = [
    { roomId: 'room_xiaoming_123', name: '王小明' },
    { roomId: 'room_zhangmom_456', name: '張媽媽' },
    { roomId: 'room_liteacher_789', name: '李老師' },
    { roomId: 'room_teamA_999', name: '專題組員 A' },
  ];

  useEffect(() => {
    // 監聽整個 messages 集合，動態分析出每個房間的最後一筆訊息與未讀數量
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // 用來暫存每個房間最新訊息的 Map
      const latestMsgMap = new Map<string, { text: string; time: any }>();
      
      // 🌟 用來統計每個房間未讀訊息數量的 Map
      const unreadCountMap = new Map<string, number>();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const rId = data.roomId;

        if (rId) {
          // 1. 抓取最後一筆訊息（因為是 desc 排序，最先拿到的就是最新的一筆）
          if (!latestMsgMap.has(rId)) {
            latestMsgMap.set(rId, {
              text: data.text || '',
              time: data.createdAt,
            });
          }

          // 2. 🌟 【未讀計算關鍵】如果這條訊息「不是我發的」而且「未讀(isRead === false 或不存在)」
          if (data.senderId !== currentUserId && data.isRead !== true) {
            const currentCount = unreadCountMap.get(rId) || 0;
            unreadCountMap.set(rId, currentCount + 1);
          }
        }
      });

      // 將預設好友與資料庫中的即時最後訊息、未讀顆數組合起來
      const updatedRooms = DEFAULT_FRIENDS.map((friend) => {
        const hasMatch = latestMsgMap.get(friend.roomId);
        const unreadCount = unreadCountMap.get(friend.roomId) || 0; // 🌟 撈出未讀數量
        
        return {
          id: friend.roomId,
          name: friend.name,
          lastMessage: hasMatch ? hasMatch.text : '點擊開始即時聊天',
          lastTime: hasMatch ? formatListTime(hasMatch.time) : '',
          unreadCount: unreadCount, // 🌟 傳入未讀數
        };
      });

      setRooms(updatedRooms);
      setLoading(false);
    }, (error) => {
      console.error("讀取列表失敗，降級為靜態顯示:", error);
      // 若 Firebase 沒連上，顯示基礎防當機資料
      setRooms(DEFAULT_FRIENDS.map(f => ({ id: f.roomId, name: f.name, lastMessage: '點擊開始即時聊天', lastTime: '', unreadCount: 0 })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 列表專用的時間格式化
  const formatListTime = (createdAt: any) => {
    if (!createdAt) return '';
    try {
      let date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt.seconds ? createdAt.seconds * 1000 : createdAt);
      if (isNaN(date.getTime())) return '';
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const handlePressFriend = (friendName: string, roomId: string) => {
    router.push({
      pathname: '/chat',
      params: { id: roomId, chatWith: friendName }
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>我的好友清單</Text>
      <View style={styles.separator} />

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.friendItem} 
            onPress={() => handlePressFriend(item.name, item.id)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.substring(0, 1)}</Text>
            </View>
            
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{item.name}</Text>
              <Text style={styles.friendStatus} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            
            <View style={styles.rightContainer}>
              <View style={styles.metaInfo}>
                {item.lastTime ? <Text style={styles.timeText}>{item.lastTime}</Text> : null}
                
                {/* 🌟 畫面上渲染紅色未讀數字泡泡 (未讀大於 0 才顯示) */}
                {item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.arrow}>〉</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 20, color: '#333' },
  separator: { marginVertical: 20, height: 1, width: '90%', backgroundColor: '#eee', alignSelf: 'center' },
  friendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2 },
  friendStatus: { fontSize: 13, color: '#666' },
  rightContainer: { flexDirection: 'row', alignItems: 'center' },
  metaInfo: { alignItems: 'flex-end', marginRight: 5 }, // 讓時間跟未讀泡泡垂直靠右排列
  timeText: { fontSize: 12, color: '#999', marginBottom: 4 },
  arrow: { fontSize: 16, color: '#ccc' },
  // 🌟 未讀小紅點樣式
  unreadBadge: {
    backgroundColor: '#FF3B30', // 精美系統紅
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});