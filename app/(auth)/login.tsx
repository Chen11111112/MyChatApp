import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { SymbolView } from 'expo-symbols';
import { Link, router } from 'expo-router';
import { auth } from '@/firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleLogin = async () => {
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('請填寫 Email 與密碼');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setShowSuccess(true);
    } catch (e: any) {
      const msg =
        e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
          ? 'Email 或密碼錯誤'
          : e.code === 'auth/user-not-found'
          ? '此帳號不存在'
          : e.code === 'auth/too-many-requests'
          ? '登入次數過多，請稍後再試'
          : e.code === 'auth/invalid-email'
          ? 'Email 格式不正確'
          : '登入失敗，請稍後再試';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>歡迎回來</Text>
        <Text style={styles.subtitle}>登入您的帳號</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="請輸入 Email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <Text style={styles.label}>密碼</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="請輸入密碼"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              activeOpacity={0.7}
            >
              <SymbolView
                name={showPassword
                  ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }
                  : { ios: 'eye', android: 'visibility', web: 'visibility' }
                }
                size={20}
                tintColor="#aaa"
              />
            </TouchableOpacity>
          </View>

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>登入</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>還沒有帳號？</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.link}>立即註冊</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showSuccess}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIcon}>✓</Text>
            <Text style={styles.modalTitle}>登入成功</Text>
            <Text style={styles.modalMessage}>歡迎回來！</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSuccess(false);
                router.replace('/(tabs)');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>確定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 36,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1a1a2e',
    backgroundColor: '#fafafa',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1a1a2e',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  error: {
    color: '#dc2f2f',
    fontSize: 13,
    marginTop: 10,
  },
  button: {
    backgroundColor: '#2f95dc',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    gap: 6,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  link: {
    color: '#2f95dc',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 40,
    color: '#2f95dc',
    fontWeight: '700',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
