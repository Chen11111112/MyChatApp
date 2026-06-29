import { router } from "expo-router";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  or,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebase";
import { useAuth } from "@/context/AuthContext";

interface ChatRoom {
  id: string;
  friendUid: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  lastTime: string;
  lastTimestamp: number;
  unreadCount: number;
}

interface FriendMeta {
  name: string;
  avatar?: string;
}

export default function TabTwoScreen() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const friendMetaRef = useRef<Map<string, FriendMeta>>(new Map());
  const roomToFriendRef = useRef<Map<string, string>>(new Map());

  const formatTime = (createdAt: any): string => {
    if (!createdAt) return "";
    try {
      const date = createdAt.toDate
        ? createdAt.toDate()
        : new Date(createdAt.seconds * 1000);
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      }
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return "";
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let unsubscribe: (() => void) | undefined;
      setLoading(true);

      const init = async () => {
        try {
          const friendsSnap = await getDocs(
            query(
              collection(db, "friends"),
              or(
                where("user1", "==", user.uid),
                where("user2", "==", user.uid),
              ),
            ),
          );

          if (friendsSnap.empty) {
            setRooms([]);
            setLoading(false);
            return;
          }

          const friendUids = [
            ...new Set(
              friendsSnap.docs.map((d) => {
                const data = d.data();
                return data.user1 === user.uid ? data.user2 : data.user1;
              }),
            ),
          ];

          const roomToFriend = new Map<string, string>();
          const friendMeta = new Map<string, FriendMeta>();

          await Promise.all(
            friendUids.map(async (uid) => {
              const roomId = [user.uid, uid].sort().join("_");
              roomToFriend.set(roomId, uid);
              const snap = await getDoc(doc(db, "users", uid));
              if (snap.exists()) {
                const d = snap.data();
                friendMeta.set(uid, {
                  name: d.nickname || d.email || "未知用戶",
                  avatar: d.avatar,
                });
              }
            }),
          );

          roomToFriendRef.current = roomToFriend;
          friendMetaRef.current = friendMeta;

          unsubscribe = onSnapshot(
            query(collection(db, "messages"), orderBy("createdAt", "desc")),
            (snapshot) => {
              const latestMap = new Map<
                string,
                { text: string; time: any; timestamp: number }
              >();
              const unreadMap = new Map<string, number>();

              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();

                const rId: string = data.roomId;
                if (!rId || !roomToFriendRef.current.has(rId)) return;

                if (!latestMap.has(rId)) {
                  latestMap.set(rId, {
                    text: data.text || "",
                    time: data.createdAt,
                    timestamp: data.createdAt?.seconds ?? 0,
                  });
                }

                if (data.senderId !== user.uid && data.isRead !== true) {
                  unreadMap.set(rId, (unreadMap.get(rId) ?? 0) + 1);
                }
              });

              const result: ChatRoom[] = [];
              latestMap.forEach((latest, roomId) => {
                const friendUid = roomToFriendRef.current.get(roomId)!;
                const meta = friendMetaRef.current.get(friendUid);
                result.push({
                  id: roomId,
                  friendUid,
                  name: meta?.name ?? "未知用戶",
                  avatar: meta?.avatar,
                  lastMessage: latest.text,
                  lastTime: formatTime(latest.time),
                  lastTimestamp: latest.timestamp,
                  unreadCount: unreadMap.get(roomId) ?? 0,
                });
              });

              result.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
              setRooms(result);
              setLoading(false);
            },
            (err) => {
              console.error("監聽失敗:", err);
              setLoading(false);
            },
          );
        } catch (err) {
          console.error("初始化失敗:", err);
          setLoading(false);
        }
      };

      init();

      return () => unsubscribe?.();
    }, [user]),
  );

  const handlePressRoom = (room: ChatRoom) => {
    router.push({
      pathname: "/chat",
      params: { id: room.id, chatWith: room.name, friendUid: room.friendUid },
    });
  };

  if (!user) return null;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>聊天</Text>
      <View style={styles.separator} />

      {rooms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>還沒有任何聊天紀錄</Text>
          <Text style={styles.emptySubText}>
            前往「好友」頁面點擊好友開始聊天吧！
          </Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const hasUnread = item.unreadCount > 0;
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handlePressRoom(item)}
              >
                <View style={styles.avatarWrap}>
                  {item.avatar ? (
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLetter}>{item.name[0]}</Text>
                    </View>
                  )}
                  {hasUnread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.unreadCount > 99
                          ? "99+"
                          : String(item.unreadCount)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.info}>
                  <Text style={[styles.name, hasUnread && styles.nameUnread]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.lastMsg, hasUnread && styles.lastMsgUnread]}
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>
                </View>

                <View style={styles.right}>
                  {item.lastTime ? (
                    <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                      {item.lastTime}
                    </Text>
                  ) : null}
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 20 },
  center: { justifyContent: "center", alignItems: "center" },
  mainTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    color: "#333",
  },
  separator: {
    marginVertical: 16,
    height: 1,
    width: "90%",
    backgroundColor: "#eee",
    alignSelf: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
  },
  emptySubText: { fontSize: 14, color: "#aaa", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  avatarWrap: { position: "relative", marginRight: 14 },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#eee",
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "500", color: "#333", marginBottom: 3 },
  nameUnread: { fontWeight: "700", color: "#111" },
  lastMsg: { fontSize: 13, color: "#aaa" },
  lastMsgUnread: { color: "#555", fontWeight: "500" },
  right: { alignItems: "flex-end", marginLeft: 8 },
  time: { fontSize: 12, color: "#bbb", marginBottom: 4 },
  timeUnread: { color: "#007AFF", fontWeight: "600" },
  chevron: { fontSize: 20, color: "#ddd" },
});
