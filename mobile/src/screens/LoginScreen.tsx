import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { requestMobileOtp } from '../lib/mobile-api';
import { colors, radii } from '../theme';
import type { LoginPortal } from '../types';
import { useAuth } from '../auth';

const portals: Array<{ id: LoginPortal; label: string }> = [
  { id: 'student', label: 'Student' },
  { id: 'staff', label: 'Staff' },
  { id: 'admin', label: 'Admin' }
];

export function LoginScreen() {
  const { verifyOtp } = useAuth();
  const [portal, setPortal] = useState<LoginPortal>('student');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'identity' | 'otp'>('identity');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function sendCode() {
    setBusy(true);
    setError('');
    try {
      await requestMobileOtp({
        portal,
        email: normalizedEmail,
        ...(portal === 'student' ? { registrationNumber: registrationNumber.trim().toUpperCase() } : {})
      });
      setStage('otp');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request a sign-in code.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    setError('');
    try {
      await verifyOtp(normalizedEmail, otp, portal);
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Unable to verify this code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
        <Text style={styles.eyebrow}>MIPC DIGITAL CAMPUS</Text>
        <Text style={styles.title}>{stage === 'identity' ? 'Secure mobile sign in' : 'Enter your sign-in code'}</Text>
        <Text style={styles.subtitle}>
          {stage === 'identity'
            ? 'Use the same verified MIPC identity as the web portal. Your stored role decides the workspace you can access.'
            : `We sent a one-time code if ${normalizedEmail || 'that address'} matches an active MIPC account.`}
        </Text>

        <View style={styles.card}>
          {stage === 'identity' ? (
            <>
              <View style={styles.segmented}>
                {portals.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => { setPortal(item.id); setError(''); }}
                    style={[styles.segment, portal === item.id && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, portal === item.id && styles.segmentTextActive]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>

              {portal === 'student' && (
                <Field
                  label="Registration number"
                  value={registrationNumber}
                  onChangeText={(value) => setRegistrationNumber(value.toUpperCase())}
                  placeholder="e.g. MIPC-2026-00125"
                  autoCapitalize="characters"
                />
              )}
              <Field
                label={portal === 'student' ? 'Registered email' : portal === 'staff' ? 'Staff email' : 'Administrator email'}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <PrimaryButton
                label={busy ? 'Checking your details…' : 'Send one-time code'}
                disabled={busy || !normalizedEmail || (portal === 'student' && registrationNumber.trim().length < 4)}
                onPress={() => void sendCode()}
              />
            </>
          ) : (
            <>
              <Field
                label="One-time code"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 8))}
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
              />
              <PrimaryButton
                label={busy ? 'Signing in…' : 'Verify and continue'}
                disabled={busy || otp.length < 6}
                onPress={() => void confirmCode()}
              />
              <Pressable onPress={() => { setStage('identity'); setOtp(''); setError(''); }} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Change sign-in details</Text>
              </Pressable>
            </>
          )}

          {busy && <ActivityIndicator style={styles.spinner} color={colors.green700} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        <Text style={styles.footer}>Muhabura Integrated Polytechnic College · Musanze, Rwanda</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} style={styles.input} placeholderTextColor={colors.ink400} />
    </View>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.primary, disabled && styles.primaryDisabled]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, backgroundColor: colors.cream50, paddingHorizontal: 22, paddingTop: 52, paddingBottom: 30 },
  brandMark: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.navy950, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  brandMarkText: { color: colors.white, fontSize: 28, fontWeight: '900' },
  eyebrow: { color: colors.green700, fontWeight: '800', letterSpacing: 1.8, fontSize: 11 },
  title: { color: colors.navy950, fontSize: 31, lineHeight: 37, fontWeight: '800', marginTop: 8 },
  subtitle: { color: colors.ink600, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 24 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 20, borderWidth: 1, borderColor: colors.line },
  segmented: { flexDirection: 'row', backgroundColor: colors.cream50, borderRadius: 14, padding: 4, marginBottom: 20 },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  segmentText: { color: colors.ink600, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: colors.navy950 },
  fieldWrap: { marginBottom: 16 },
  label: { color: colors.navy950, fontWeight: '700', fontSize: 13, marginBottom: 7 },
  input: { minHeight: 50, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.ink950, fontSize: 16 },
  primary: { minHeight: 50, borderRadius: 13, backgroundColor: colors.green700, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  secondaryAction: { alignItems: 'center', paddingVertical: 16 },
  secondaryActionText: { color: colors.green700, fontWeight: '700' },
  spinner: { marginTop: 14 },
  error: { marginTop: 14, color: colors.danger, backgroundColor: colors.dangerBg, padding: 12, borderRadius: 10, lineHeight: 20 },
  footer: { color: colors.ink400, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 24 }
});
