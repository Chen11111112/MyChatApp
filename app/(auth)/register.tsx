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
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { SymbolView } from 'expo-symbols';
import { Link, router } from 'expo-router';
import { auth, db } from '@/firebase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    setErrorMsg('');
    if (!email.trim() || !password || !confirmPassword) {
      setErrorMsg('請填寫 Email 與密碼欄位');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('密碼至少需要 6 個字元');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('兩次輸入的密碼不一致');
      return;
    }

    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, 'users', user.uid), {
        email: email.trim(),
        nickname: nickname.trim() || email.split('@')[0],
        avatarUrl: '',
        createdAt: serverTimestamp(),
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg =
        e.code === 'auth/email-already-in-use'
          ? '此 Email 已被註冊'
          : e.code === 'auth/invalid-email'
          ? 'Email 格式不正確'
          : e.code === 'auth/weak-password'
          ? '密碼強度不足（至少 6 個字元）'
          : '註冊失敗，請稍後再試';
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
        <Text style={styles.title}>建立帳號</Text>
        <Text style={styles.subtitle}>填寫以下資料完成註冊</Text>

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

          <Text style={styles.label}>暱稱（選填）</Text>
          <TextInput
            style={styles.input}
            placeholder="請輸入暱稱"
            placeholderTextColor="#aaa"
            value={nickname}
            onChangeText={setNickname}
          />

          <Text style={styles.label}>密碼</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="至少 6 個字元"
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

          <Text style={styles.label}>確認密碼</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="請再次輸入密碼"
              placeholderTextColor="#aaa"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword((v) => !v)}
              activeOpacity={0.7}
            >
              <SymbolView
                name={showConfirmPassword
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
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>註冊</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>已有帳號？</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.link}>返回登入</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
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
});
