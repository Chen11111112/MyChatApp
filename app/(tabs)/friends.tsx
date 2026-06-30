import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { collection, query, where, getDocs, addDoc, or, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/context/AuthContext';
import { searchUsers, SearchUser } from '@/services/userSearch';

export default function FriendsScreen() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [systemMsg, setSystemMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [friendList, setFriendList] = useState<SearchUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (viewMode === 'list' && user) {
      fetchFriends();
    }
  }, [viewMode, user]);

  const fetchFriends = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const q = query(
        collection(db, 'friends'),
        or(where('user1', '==', user.uid), where('user2', '==', user.uid))
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) { setFriendList([]); return; }

      const friendUids = snapshot.docs.map(d => {
        const data = d.data();
        return data.user1 === user.uid ? data.user2 : data.user1;
      });
      const uniqueFriendUids = [...new Set(friendUids)];

      const friendsData: SearchUser[] = [];
      await Promise.all(
        uniqueFriendUids.map(async (uid) => {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            friendsData.push({ id: userSnap.id, ...userSnap.data() } as SearchUser);
          }
        })
      );
      setFriendList(friendsData);
    } catch (error) {
      console.error('讀取好友失敗', error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleChatWithFriend = (friend: SearchUser) => {
    if (!user) return;
    const roomId = [user.uid, friend.id].sort().join('_');
    const friendName = friend.nickname || friend.email || '好友';
    router.push({ pathname: '/chat', params: { id: roomId, chatWith: friendName, friendUid: friend.id } });
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
      setSearchResults([]);
      const results = await searchUsers(text, user?.uid);
      setSearchResults(results);
      setHasSearched(true);
    } catch {
      setSystemMsg({ text: '搜尋時發生問題，請稍後再試', ok: false });
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleAddFriend = async (target: SearchUser) => {
    if (!user) return;
    setSystemMsg(null);
    if (user.uid === target.id) {
      setSystemMsg({ text: '你不能加自己為好友喔！', ok: false });
      return;
    }
    const existingQuery = query(
      collection(db, 'friends'),
      or(
        where('user1', '==', user.uid),
        where('user2', '==', user.uid)
      )
    );
    const existingSnap = await getDocs(existingQuery);
    const alreadyFriend = existingSnap.docs.some(d => {
      const data = d.data();
      return data.user1 === target.id || data.user2 === target.id;
    });
    if (alreadyFriend) {
      setSystemMsg({ text: '已經是好友了！', ok: false });
      return;
    }

    setAddingUid(target.id);
    try {
      await addDoc(collection(db, 'friends'), {
        user1: user.uid,
        user2: target.id,
        createdAt: new Date(),
      });
      const displayName = target.nickname || target.email;
      setSystemMsg({ text: `已成功將 ${displayName} 加為好友！`, ok: true });
      setSearchResults((prev) => prev.filter((u) => u.id !== target.id));
      setTimeout(() => setViewMode('list'), 1500);
    } catch {
      setSystemMsg({ text: '無法加入好友，請稍後再試', ok: false });
    } finally {
      setAddingUid(null);
    }
  };

  const renderUserRow = (u: SearchUser, showAddButton = false) => (
    <View key={u.id} style={styles.resultCard}>
      <View style={styles.userInfoRow}>
        {u.avatar ? (
          <Image source={{ uri: u.avatar }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {u.nickname ? u.nickname[0].toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{u.nickname || '未設定暱稱'}</Text>
          <Text style={styles.emailText}>{u.email}</Text>
        </View>
      </View>
      {showAddButton && (
        <TouchableOpacity
          style={[styles.button, addingUid === u.id && styles.buttonDisabled]}
          onPress={() => handleAddFriend(u)}
          disabled={addingUid === u.id}
          activeOpacity={0.8}
        >
          {addingUid === u.id ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>加為好友</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  if (!user) return null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, viewMode === 'list' && styles.tabButtonActive]}
            onPress={() => setViewMode('list')} activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'list' && styles.tabTextActive]}>我的好友</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, viewMode === 'add' && styles.tabButtonActive]}
            onPress={() => setViewMode('add')} activeOpacity={0.8}
          >
            <Text style={[styles.tabText, viewMode === 'add' && styles.tabTextActive]}>新增好友</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'list' && (
          <View style={styles.section}>
            {loadingFriends ? (
              <ActivityIndicator size="large" color="#2f95dc" style={{ marginTop: 40 }} />
            ) : friendList.length > 0 ? (
              friendList.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={styles.friendCard}
                  onPress={() => handleChatWithFriend(friend)}
                  activeOpacity={0.75}
                >
                  <View style={styles.userInfoRow}>
                    {friend.avatar ? (
                      <Image source={{ uri: friend.avatar }} style={styles.avatarImage} />
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
                    <Text style={styles.chatArrow}>💬</Text>
                  </View>
                </TouchableOpacity>
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

        {viewMode === 'add' && (
          <View style={styles.section}>
            <Text style={styles.label}>搜尋用戶</Text>
            <TextInput
              style={styles.input}
              placeholder="輸入好友的暱稱或 Email"
              placeholderTextColor="#aaa"
              value={searchText}
              onChangeText={(text) => { setSearchText(text); setSystemMsg(null); }}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.button, loadingSearch && styles.buttonDisabled]}
              onPress={handleSearch} disabled={loadingSearch} activeOpacity={0.8}
            >
              {loadingSearch ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>搜尋</Text>}
            </TouchableOpacity>

            <View style={styles.divider} />

            {hasSearched && (
              <View>
                <Text style={styles.sectionTitle}>
                  搜尋結果{searchResults.length > 0 ? `（${searchResults.length} 筆）` : ''}
                </Text>
                {searchResults.length > 0 ? (
                  searchResults.map((u) => renderUserRow(u, true))
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
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f1f1', borderRadius: 12, padding: 4, marginBottom: 24 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#1a1a2e', fontWeight: '700' },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1a1a2e', backgroundColor: '#fafafa' },
  button: { backgroundColor: '#2f95dc', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 24 },
  successMsg: { color: '#2e7d32', fontSize: 13, marginTop: 8 },
  errorMsg: { color: '#dc2f2f', fontSize: 13, marginTop: 8 },
  systemMsgContainer: { textAlign: 'center', fontSize: 15, marginTop: 20, fontWeight: '600' },
  resultCard: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 16, padding: 20, backgroundColor: '#fafafa', marginBottom: 12 },
  friendCard: { borderWidth: 1.5, borderColor: '#eee', borderRadius: 16, padding: 16, backgroundColor: '#fff', marginBottom: 12 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center' },
  avatarImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eee', marginRight: 16 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2f95dc', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  textContainer: { flex: 1 },
  nameText: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  emailText: { fontSize: 14, color: '#666' },
  chatArrow: { fontSize: 20 },
  emptyStateBox: { borderWidth: 1.5, borderColor: '#eee', borderRadius: 12, borderStyle: 'dashed', padding: 32, alignItems: 'center', backgroundColor: '#fafafa', marginTop: 20 },
  emptyStateText: { color: '#888', fontSize: 15, fontWeight: '600', marginBottom: 16 },
  smallButton: { backgroundColor: '#1a1a2e', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  smallButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
