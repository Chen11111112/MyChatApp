import { useEffect, useState } from 'react';
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
  Modal,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { auth, db } from '@/firebase';
import { useAuth } from '@/context/AuthContext';
import { toSearchableNickname } from '@/utils/userFields';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [nicknameMsg, setNicknameMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setNickname(data.nickname ?? '');
        setAvatarUrl(data.avatar ?? '');
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handlePickAndUploadAvatar = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (Platform.OS === 'web') {
        alert('請允許存取相簿後再選擇頭像');
      } else {
        Alert.alert('權限不足', '請允許存取相簿後再選擇頭像');
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,  // 壓低品質確保 base64 字串 < 1MB（Firestore 單文件上限）
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];

    if (!asset.base64) {
      setAvatarMsg({ text: '無法取得圖片資料，請再試一次', ok: false });
      return;
    }

    setAvatarPreview(asset.uri);
    setAvatarMsg({ text: '正在儲存頭像...', ok: false });
    setUploadingAvatar(true);

    try {
      const mimeType = asset.mimeType || 'image/jpeg';
      const base64Url = `data:${mimeType};base64,${asset.base64}`;

      // 直接將 base64 字串存入 Firestore，不需要 Firebase Storage
      await setDoc(
        doc(db, 'users', user.uid),
        { avatar: base64Url },
        { merge: true }
      );

      setAvatarUrl(base64Url);
      setAvatarPreview(null);
      setAvatarMsg({ text: '頭像已更新', ok: true });
    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      setAvatarPreview(null);
      const message =
        error?.code === 'resource-exhausted'
          ? '圖片太大，請選擇較小的圖片'
          : '頭像儲存失敗，請稍後再試';
      setAvatarMsg({ text: message, ok: false });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!user) return;
    setNicknameMsg(null);
    if (!nickname.trim()) {
      setNicknameMsg({ text: '暱稱不能為空', ok: false });
      return;
    }
    setLoadingProfile(true);
    try {
      const trimmed = nickname.trim();
      await updateDoc(doc(db, 'users', user.uid), {
        nickname: trimmed,
        nicknameLower: toSearchableNickname(trimmed),
      });
      setNicknameMsg({ text: '暱稱已更新', ok: true });
    } catch {
      setNicknameMsg({ text: '更新失敗，請稍後再試', ok: false });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;
    setPasswordMsg(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMsg({ text: '請填寫所有密碼欄位', ok: false });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: '新密碼至少需要 6 個字元', ok: false });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ text: '新密碼與確認密碼不一致', ok: false });
      return;
    }
    setLoadingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMsg({ text: '密碼已更新', ok: true });
    } catch (e: any) {
      const msg =
        e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
          ? '目前密碼錯誤'
          : e.code === 'auth/weak-password'
          ? '新密碼強度不足'
          : '更新失敗，請稍後再試';
      setPasswordMsg({ text: msg, ok: false });
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    setLoadingSignOut(true);
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } finally {
      setLoadingSignOut(false);
    }
  };

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.avatarButton} onPress={handlePickAndUploadAvatar} activeOpacity={0.8}>
          <View style={styles.avatarCircle}>
            {avatarPreview || avatarUrl ? (
              <Image source={{ uri: avatarPreview || avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{nickname ? nickname[0].toUpperCase() : '?'}</Text>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>點擊更換頭像</Text>
        {avatarMsg ? <Text style={avatarMsg.ok ? styles.successMsg : styles.errorMsg}>{avatarMsg.text}</Text> : null}
        <Text style={styles.email}>{user.email}</Text>

        {/* 修改暱稱 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>修改暱稱</Text>
          <Text style={styles.label}>暱稱</Text>
          <TextInput
            style={styles.input}
            placeholder="請輸入新暱稱"
            placeholderTextColor="#aaa"
            value={nickname}
            onChangeText={setNickname}
          />
          {nicknameMsg ? (
            <Text style={nicknameMsg.ok ? styles.successMsg : styles.errorMsg}>{nicknameMsg.text}</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.button, loadingProfile && styles.buttonDisabled]}
            onPress={handleUpdateNickname}
            disabled={loadingProfile}
            activeOpacity={0.8}
          >
            {loadingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>儲存暱稱</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 修改密碼 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>修改密碼</Text>

          <Text style={styles.label}>目前密碼</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="請輸入目前密碼"
              placeholderTextColor="#aaa"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPw}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrentPw((v) => !v)} activeOpacity={0.7}>
              <SymbolView
                name={showCurrentPw ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }}
                size={20} tintColor="#aaa"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>新密碼</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="至少 6 個字元"
              placeholderTextColor="#aaa"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPw}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPw((v) => !v)} activeOpacity={0.7}>
              <SymbolView
                name={showNewPw ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }}
                size={20} tintColor="#aaa"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>確認新密碼</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="請再次輸入新密碼"
              placeholderTextColor="#aaa"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry={!showConfirmPw}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPw((v) => !v)} activeOpacity={0.7}>
              <SymbolView
                name={showConfirmPw ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }}
                size={20} tintColor="#aaa"
              />
            </TouchableOpacity>
          </View>

          {passwordMsg ? (
            <Text style={passwordMsg.ok ? styles.successMsg : styles.errorMsg}>{passwordMsg.text}</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.button, loadingPassword && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={loadingPassword}
            activeOpacity={0.8}
          >
            {loadingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>更新密碼</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.signOutButton, loadingSignOut && styles.buttonDisabled]}
          onPress={() => setShowSignOutModal(true)}
          disabled={loadingSignOut}
          activeOpacity={0.8}
        >
          {loadingSignOut ? <ActivityIndicator color="#dc2f2f" /> : <Text style={styles.signOutText}>登出</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showSignOutModal} onRequestClose={() => setShowSignOutModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>確認登出</Text>
            <Text style={styles.modalMessage}>確定要登出帳號嗎？</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSignOutModal(false)} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSignOut} activeOpacity={0.8}>
                <Text style={styles.modalConfirmText}>登出</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, backgroundColor: '#fff' },
  avatarButton: { alignSelf: 'center' },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#2f95dc',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', overflow: 'hidden', marginBottom: 8,
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  avatarHint: { textAlign: 'center', color: '#666', fontSize: 12, marginBottom: 8 },
  email: { textAlign: 'center', color: '#666', fontSize: 14, marginBottom: 32 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    color: '#1a1a2e', backgroundColor: '#fafafa',
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, backgroundColor: '#fafafa',
  },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1a1a2e' },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 14 },
  successMsg: { color: '#2e7d32', fontSize: 13, marginTop: 8 },
  errorMsg: { color: '#dc2f2f', fontSize: 13, marginTop: 8 },
  button: {
    backgroundColor: '#2f95dc', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 24 },
  signOutButton: {
    borderWidth: 1.5, borderColor: '#dc2f2f', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  signOutText: { color: '#dc2f2f', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%', maxWidth: 320 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  modalMessage: { fontSize: 14, color: '#666', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { color: '#444', fontSize: 15, fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: '#dc2f2f', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});