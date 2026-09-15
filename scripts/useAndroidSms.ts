import { useState, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { smsToExpense, PipelineResult } from './smsPipeline';

const SmsAndroid = require('react-native-get-sms-android');

export interface ScannedMessage {
  id: string;
  body: string;
  date: number;
  result: PipelineResult | null;
  parsing: boolean;
  error: string | null;
}

const CARD_KEYWORDS = ['승인', '결제', '카드', '원'];
function isCardSms(body: string): boolean {
  const matched = CARD_KEYWORDS.filter(k => body.includes(k)).length;
  return matched >= 2 && /[\d,]+원/.test(body);
}

function daysAgoMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export function useAndroidSms() {
  const [messages, setMessages] = useState<ScannedMessage[]>([]);
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async () => {
    if (Platform.OS !== 'android') return;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS 읽기 권한 필요',
        message:
          '카드 결제 문자를 자동으로 인식하기 위해\nSMS 읽기 권한이 필요해요.',
        buttonPositive: '허용',
        buttonNegative: '거부',
      },
    );

    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert(
        '권한 필요',
        'SMS 권한이 영구 거부되어 있어요.\n설정에서 직접 허용해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('권한 거부', 'SMS 권한이 없으면 자동 스캔을 사용할 수 없어요.');
      return;
    }

    setScanning(true);
    setMessages([]);

    const filter = JSON.stringify({
      box: 'inbox',
      minDate: daysAgoMs(90),
      maxCount: 500,
    });

    SmsAndroid.list(
      filter,
      (err: string) => {
        setScanning(false);
        Alert.alert('스캔 실패', err);
      },
      async (_count: number, smsList: string) => {
        type RawSms = { _id: string; body: string; date: number };
        const all: RawSms[] = JSON.parse(smsList);
        const cardMsgs = all.filter(m => isCardSms(m.body));

        if (cardMsgs.length === 0) {
          setScanning(false);
          Alert.alert('결과 없음', '최근 90일 내 카드 결제 문자를 찾지 못했어요.');
          return;
        }

        const initial: ScannedMessage[] = cardMsgs.map(m => ({
          id: m._id,
          body: m.body,
          date: m.date,
          result: null,
          parsing: true,
          error: null,
        }));
        setMessages(initial);
        setScanning(false);

        for (const msg of cardMsgs) {
          try {
            const result = await smsToExpense(msg.body);
            setMessages(prev =>
              prev.map(m =>
                m.id === msg._id ? { ...m, result, parsing: false } : m,
              ),
            );
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            setMessages(prev =>
              prev.map(m =>
                m.id === msg._id ? { ...m, error: errorMsg, parsing: false } : m,
              ),
            );
          }
        }
      },
    );
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, scanning, scan, clear };
}
