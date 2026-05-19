import { Audio } from 'expo-av';
import { processVoice } from '../../scripts/voicePipeline';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';

export default function VoiceScreen() {
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState('');

  const handleMic = async () => {
    if (recording) return;

    try {
      setRecording(true);
      setResult('');

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setResult('마이크 권한 필요');
        setRecording(false);
        return;
      }

      const recordingObj = new Audio.Recording();
      await recordingObj.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recordingObj.startAsync();

      setTimeout(async () => {
        await recordingObj.stopAndUnloadAsync();

        const uri = recordingObj.getURI();

        const file = {
          uri,
          name: 'audio.m4a',
          type: 'audio/m4a',
        };

        const pipe = await processVoice(file);
        const e = pipe.data;

        const missing = [
          e.amount == null    && 'amount',
          !e.storeName        && 'storeName',
          !e.category         && 'category',
        ].filter(Boolean);

        setResult(
          `결제금액: ${e.amount ?? '없음'}원\n` +
          `가게명: ${e.storeName ?? '없음'}\n` +
          `결제일시: ${e.paymentDate}\n` +
          `카테고리: ${e.category ?? '없음'}\n` +
          `메모: ${e.memo ?? '없음'}\n` +
          `\n신뢰도: ${pipe.confidence} · ${pipe.elapsedMs}ms` +
          (missing.length > 0
            ? `\n⚠️ 비어 있는 항목: ${missing.join(', ')}`
            : '')
        );

        setRecording(false);
      }, 3000);

    } catch (e: any) {
      setResult('에러: ' + e.message);
      setRecording(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← 뒤로 가기</Text>
      </Pressable>

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
          {recording ? '음성 인식 중입니다...' : '탭해서 시작'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F7F8FA',
  },

  back: {
    color: '#5B8CCB',
    marginBottom: 10,
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