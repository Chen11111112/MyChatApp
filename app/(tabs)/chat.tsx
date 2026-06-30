import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useRef, useState, memo, useCallback } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebase";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: any;
  isRead?: boolean;
}

interface FriendInfo {
  nickname?: string;
  avatar?: string;
  email?: string;
}

const Avatar = memo(
  ({
    friendInfo,
    chatWith,
    size = 32,
  }: {
    friendInfo: FriendInfo;
    chatWith: string;
    size?: number;
  }) => {
    if (friendInfo.avatar) {
      return (
        <Image
          source={{ uri: friendInfo.avatar }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#eee",
          }}
        />
      );
    }
    const initial = (friendInfo.nickname || chatWith || "?")[0].toUpperCase();
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#2f95dc",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: "#fff", fontSize: size * 0.45, fontWeight: "700" }}
        >
          {initial}
        </Text>
      </View>
    );
  },
);

const MessageBubble = memo(
  ({
    item,
    currentUserId,
    friendInfo,
    chatWith,
    formatTime,
  }: {
    item: Message;
    currentUserId: string;
    friendInfo: FriendInfo;
    chatWith: string;
    formatTime: (t: any) => string;
  }) => {
    const isMe = item.senderId === currentUserId;
    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && (
          <View style={styles.avatarWrapper}>
            <Avatar friendInfo={friendInfo} chatWith={chatWith} size={30} />
          </View>
        )}
        {isMe && (
          <View style={styles.metaColumn}>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            <Text
              style={[
                styles.readStatus,
                item.isRead ? styles.readDone : styles.readPending,
              ]}
            >
              {item.isRead ? "已讀" : "未讀"}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.otherBubble,
          ]}
        >
          <Text style={isMe ? styles.myText : styles.otherText}>
            {item.text}
          </Text>
        </View>
        {!isMe && (
          <View style={styles.metaColumn}>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
        )}
      </View>
    );
  },
);

export default function ChatScreen() {
  const {
    id: roomId,
    chatWith,
    friendUid,
  } = useLocalSearchParams<{
    id: string;
    chatWith: string;
    friendUid: string;
  }>();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [friendInfo, setFriendInfo] = useState<FriendInfo>({});

  useEffect(() => {
    if (!friendUid) return;
    getDoc(doc(db, "users", friendUid))
      .then((snap) => {
        if (snap.exists()) setFriendInfo(snap.data() as FriendInfo);
      })
      .catch(console.error);
  }, [friendUid]);

  useEffect(() => {
    if (!roomId || !user) return;

    const q = query(
      collection(db, "messages"),
      where("roomId", "==", roomId),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgList: Message[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Message, "id">),
        }));
        setMessages(msgList);

        const batch = writeBatch(db);
        let hasUpdates = false; 
        snapshot.docs.forEach((document) => {
          const data = document.data();
          if (data.senderId !== user.uid && data.isRead !== true) {
            batch.update(doc(db, "messages", document.id), { isRead: true });
            hasUpdates = true;
          }
        });
        if (hasUpdates) batch.commit().catch(console.error);

        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          80,
        );
      },
      console.error,
    );

    return () => unsubscribe();
  }, [roomId, user]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !user) return;
    const text = inputText.trim();
    setInputText("");
    try {
      await addDoc(collection(db, "messages"), {
        roomId,
        senderId: user.uid,
        text,
        createdAt: serverTimestamp(),
        isRead: false,
      });
    } catch (error) {
      console.error("發送失敗:", error);
    }
  }, [inputText, user, roomId]);

  const formatTime = useCallback((createdAt: any) => {
    if (!createdAt) return "";
    try {
      const date = createdAt.toDate
        ? createdAt.toDate()
        : new Date(createdAt.seconds * 1000);
      if (isNaN(date.getTime())) return "";
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        item={item}
        currentUserId={user?.uid ?? ""}
        friendInfo={friendInfo}
        chatWith={chatWith ?? ""}
        formatTime={formatTime}
      />
    ),
    [user?.uid, friendInfo, chatWith, formatTime],
  );

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/two")}
          style={styles.backBtn}
        >
          <Text style={styles.backButton}>〈 返回</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Avatar friendInfo={friendInfo} chatWith={chatWith ?? ""} size={36} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chatWith || friendInfo.nickname || "聊天室"}
          </Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={renderItem}
        removeClippedSubviews
        windowSize={10}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="輸入訊息..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>傳送</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 15,
  },
  backBtn: { width: 70 },
  backButton: { fontSize: 16, color: "#007AFF" },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "bold", maxWidth: 160 },
  messageList: { padding: 15, paddingBottom: 20 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 6,
    maxWidth: "80%",
  },
  myRow: { alignSelf: "flex-end" },
  otherRow: { alignSelf: "flex-start" },
  avatarWrapper: { marginRight: 6, marginBottom: 2 },
  messageBubble: {
    padding: 10,
    borderRadius: 18,
    marginHorizontal: 4,
    maxWidth: 220,
  },
  myBubble: { backgroundColor: "#007AFF", borderBottomRightRadius: 4 },
  otherBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderBottomLeftRadius: 4,
  },
  myText: { color: "#fff", fontSize: 15, lineHeight: 20 },
  otherText: { color: "#333", fontSize: 15, lineHeight: 20 },
  metaColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginHorizontal: 4,
    marginBottom: 2,
  },
  timeText: {
    fontSize: 10,
    color: "#bbb",
  },
  readStatus: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  readDone: {
    color: "#34C759",
  },
  readPending: {
    color: "#999",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 21,
    paddingHorizontal: 16,
    backgroundColor: "#fafafa",
    marginRight: 10,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 21,
  },
  sendButtonDisabled: { backgroundColor: "#a0c4f1" },
  sendButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
