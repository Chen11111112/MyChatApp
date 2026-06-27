import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Image 
} from 'react-native';
// 1. 新增 doc 與 getDoc 用來撈取個別用戶資料
import { collection, query, where, getDocs, addDoc, or, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/context/AuthContext';

interface UserType {
  id: string;
  email: string;
  nickname?: string;
  avatarUrl?: string;
  [key: string]: any;
}

export default function FriendsScreen() {
  const { user } = useAuth();
  
  // 用來控制目前顯示哪一個畫面 ('list' = 好友列表, 'add' = 新增好友)
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');

  // === 新增好友功能相關狀態 ===
  const [searchText, setSearchText] = useState('');
  const [searchResult, setSearchResult] = useState<UserType | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [systemMsg, setSystemMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // === 好友列表功能相關狀態 ===
  const [friendList, setFriendList] = useState<UserType[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // 2. 當切換到「好友列表」模式時，自動去資料庫撈資料
  useEffect(() => {
    if (viewMode === 'list' && user) {
      fetchFriends();
    }
  }, [viewMode, user]);

  // 3. 讀取好友列表邏輯
  const fetchFriends = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      // 步驟一：查詢 friends 集合，找出包含自己 UID 的所有關聯紀錄
      const q = query(
        collection(db, "friends"),
        or(
          where("user1", "==", user.uid),
          where("user2", "==", user.uid)
        )
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setFriendList([]); // 沒好友
        return;
      }

      // 步驟二：從紀錄中萃取出「對方」的 UID，並過濾掉重複項
      const friendUids = snapshot.docs.map(document => {
        const data = document.data();
        // 如果 user1 是自己，那朋友就是 user2；反之亦然
        return data.user1 === user.uid ? data.user2 : data.user1;
      });
      const uniqueFriendUids = [...new Set(friendUids)];

      // 步驟三：根據對方的 UID，去 users 集合把他們的詳細資料（頭像、暱稱）撈出來
      const friendsData: UserType[] = [];
      await Promise.all(
        uniqueFriendUids.map(async (uid) => {
          const userRef = doc(db, "users", uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            friendsData.push({ id: userSnap.id, ...userSnap.data() } as UserType);
          }
        })
      );

      setFriendList(friendsData);
    } catch (error) {
      console.error("讀取好友失敗", error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSearch = async () => {
    setSystemMsg(null);
    const text = searchText.trim();
    if (!text) {
      setSystemMsg({ text: '請輸入暱稱或 Email', ok: false });
      return;
    }
    setLoadingSearch(true);
    try {
      setHasSearched(false);
      setSearchResult(null);
      const q = query(
        collection(db, "users"), 
        or(where("email", "==", text), where("nickname", "==", text))
      );
      const querySnapshot = await getDocs(q);
      setHasSearched(true);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        setSearchResult({ id: userDoc.id, ...userDoc.data() } as UserType);
      } else {
        setSearchResult(null); 
      }
    } catch (error) {
      setSystemMsg({ text: '搜尋時發生問題，請稍後再試', ok: false });
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult || !user) return;
    setSystemMsg(null);
    if (user.uid === searchResult.id) {
      setSystemMsg({ text: '你不能加自己為好友喔！', ok: false });
      return;
    }
    setLoadingAdd(true);
    try {
      await addDoc(collection(db, "friends"), {
        user1: user.uid,
        user2: searchResult.id,
        createdAt: new Date(),
      });
      const displayName = searchResult.nickname || searchResult.email;
      setSystemMsg({ text: `已成功將 ${displayName} 加為好友！`, ok: true });
      
      // 加入成功後，可以自動切換回列表模式並重新讀取
      setTimeout(() => setViewMode('list'), 1500);
      
    } catch (error) {
      setSystemMsg({ text: '無法加入好友，請稍後再試', ok: false });
    } finally {
      setLoadingAdd(false);
    }
  };

  if (!user) return null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* 4. 頂部切換選單 */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'list' && styles.tabButtonActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'list' && styles.tabTextActive]}>我的好友</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, viewMode === 'add' && styles.tabButtonActive]}
            onPress={() => setViewMode('add')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'add' && styles.tabTextActive]}>新增好友</Text>
          </TouchableOpacity>
        </View>

        {/* ===================== 模式A：好友列表 ===================== */}
        {viewMode === 'list' && (
          <View style={styles.section}>
            {loadingFriends ? (
              <ActivityIndicator size="large" color="#2f95dc" style={{ marginTop: 40 }} />
            ) : friendList.length > 0 ? (
              friendList.map((friend) => (
                <View key={friend.id} style={styles.friendCard}>
                  <View style={styles.userInfoRow}>
                    {friend.avatarUrl ? (
                      <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                          {friend.nickname ? friend.nickname[0].toUpperCase() : '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.textContainer}>
                      <Text style={styles.nameText}>{friend.nickname || '未設定暱稱'}</Text>
                      <Text style={styles.emailText}>{friend.email}</Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateText}>目前還沒有加入任何好友喔</Text>
                <TouchableOpacity style={styles.smallButton} onPress={() => setViewMode('add')}>
                  <Text style={styles.smallButtonText}>去尋找好友</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ===================== 模式B：新增好友 ===================== */}
        {viewMode === 'add' && (
          <View style={styles.section}>
            <Text style={styles.label}>搜尋用戶</Text>
            <TextInput 
              style={styles.input}
              placeholder="輸入好友的暱稱或 Email"
              placeholderTextColor="#aaa"
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                setSystemMsg(null);
              }}
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.button, loadingSearch && styles.buttonDisabled]} onPress={handleSearch} disabled={loadingSearch} activeOpacity={0.8}>
              {loadingSearch ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>搜尋</Text>}
            </TouchableOpacity>

            <View style={styles.divider} />

            {hasSearched && (
              <View>
                <Text style={styles.sectionTitle}>搜尋結果</Text>
                {searchResult ? (
                  <View style={styles.resultCard}>
                    <View style={styles.userInfoRow}>
                      {searchResult.avatarUrl ? (
                        <Image source={{ uri: searchResult.avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{searchResult.nickname ? searchResult.nickname[0].toUpperCase() : '?'}</Text>
                        </View>
                      )}
                      <View style={styles.textContainer}>
                        <Text style={styles.nameText}>{searchResult.nickname || '未設定暱稱'}</Text>
                        <Text style={styles.emailText}>{searchResult.email}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={[styles.button, loadingAdd && styles.buttonDisabled]} onPress={handleAddFriend} disabled={loadingAdd} activeOpacity={0.8}>
                      {loadingAdd ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>加為好友</Text>}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyStateBox}>
                    <Text style={styles.emptyStateText}>找不到符合條件的用戶</Text>
                  </View>
                )}
              </View>
            )}

            {systemMsg && (
              <Text style={[systemMsg.ok ? styles.successMsg : styles.errorMsg, styles.systemMsgContainer]}>
                {systemMsg.text}
              </Text>
            )}
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#fff' },
  
  // 頂部 Tab 切換樣式
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#1a1a2e',
    fontWeight: '700',
  },

  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    color: '#1a1a2e', backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#2f95dc', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 24 },
  
  successMsg: { color: '#2e7d32', fontSize: 13, marginTop: 8 },
  errorMsg: { color: '#dc2f2f', fontSize: 13, marginTop: 8 },
  systemMsgContainer: { textAlign: 'center', fontSize: 15, marginTop: 20, fontWeight: '600' },
  
  // 好友卡片與搜尋結果共用樣式
  resultCard: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 16,
    padding: 20, backgroundColor: '#fafafa',
  },
  friendCard: {
    borderWidth: 1.5, borderColor: '#eee', borderRadius: 16,
    padding: 16, backgroundColor: '#fff', marginBottom: 12,
  },
  userInfoRow: { flexDirection: 'row', alignItems: 'center' },
  avatarImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eee', marginRight: 16 },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#2f95dc',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  textContainer: { flex: 1 },
  nameText: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  emailText: { fontSize: 14, color: '#666' },
  
  emptyStateBox: {
    borderWidth: 1.5, borderColor: '#eee', borderRadius: 12, borderStyle: 'dashed',
    padding: 32, alignItems: 'center', backgroundColor: '#fafafa', marginTop: 20,
  },
  emptyStateText: { color: '#888', fontSize: 15, fontWeight: '600', marginBottom: 16 },
  smallButton: {
    backgroundColor: '#1a1a2e', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8,
  },
  smallButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' }
});