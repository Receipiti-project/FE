import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { processVoice } from '../../scripts/voicePipeline';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';

const HITSLOP = { top: 12, bottom: 12, left: 12, right: 12 } as const;

export default function VoiceScreen() {
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    AudioModule.requestRecordingPermissionsAsync().then(({ granted }) => {
      setPermissionGranted(granted);
    });
    audioRecorder.prepareToRecordAsync();
  }, []);

  const handleMic = async () => {
    if (recording) {
      try {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;

        const file = { uri, name: 'audio.m4a', type: 'audio/m4a' };
        const pipe = await processVoice(file);
        const e = pipe.data;

        const missing = [
          e.amount == null && '결제금액',
          !e.storeName     && '가게명',
          !e.category      && '카테고리',
        ].filter(Boolean);

        setResult(
          `결제금액: ${e.amount ?? '없음'}원\n` +
          `가게명: ${e.storeName ?? '없음'}\n` +
          `결제일시: ${e.paymentDate}\n` +
          `카테고리: ${e.category ?? '없음'}\n` +
          `메모: ${e.memo ?? '없음'}` +
          (missing.length > 0
            ? `\n\n⚠️ 비어 있는 항목: ${missing.join(', ')}`
            : '')
        );
        await audioRecorder.prepareToRecordAsync();
      } catch (e: any) {
        setResult('에러: ' + e.message);
      } finally {
        setRecording(false);
      }
    } else {
      if (!permissionGranted) {
        setResult('마이크 권한 필요');
        return;
      }
      try {
        setResult('');
        audioRecorder.record();
        setRecording(true);
      } catch (e: any) {
        setResult('에러: ' + e.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={HITSLOP}>
        <Ionicons name="chevron-back" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>음성 입력</Text>

        <Text style={styles.sub}>
          마이크 버튼을 눌러 지출 정보를 말해주세요
        </Text>

        <Pressable
          style={[styles.mic, recording && styles.micActive]}
          onPress={handleMic}
        >
          <Text style={styles.micIcon}>🎤</Text>
        </Pressable>

        <Text style={styles.status}>
          {recording ? '녹음 중... 탭해서 중지' : '탭해서 시작'}
        </Text>

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>인식 결과</Text>

          {result !== '' ? (
             <Text style={styles.resultText}>{result}</Text>
          ) : (
             <Text style={styles.placeholder}>결과가 여기에 표시됩니다</Text>
          )}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F7F8FA',
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  sub: {
    color: '#777',
    marginVertical: 20,
    textAlign: 'center',
  },

  mic: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#5B8CCB',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },

  micActive: {
    backgroundColor: '#FF6B6B',
  },

  micIcon: {
    fontSize: 40,
  },

  status: {
    color: '#777',
  },

  resultBox: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#ECEFF3',
    borderRadius: 12,
    width: '100%',
  },

  resultLabel: {
    color: '#888',
    marginBottom: 8,
  },

  resultText: {
    fontSize: 18,
    fontWeight: '600',
  },

  placeholder: {
    color: '#bbb',
  },
});