import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StyleSheet } from 'react-native';

export default function ManualScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>직접 입력 화면</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
});