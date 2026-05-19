import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';

export function useSharedSms(onReceived: (text: string) => void) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (hasShareIntent && shareIntent?.text) {
      onReceived(shareIntent.text);
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, resetShareIntent, onReceived]);
}
