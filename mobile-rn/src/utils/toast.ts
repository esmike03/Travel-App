// Lightweight replacement for android.widget.Toast used in the original screens.
import { Platform, ToastAndroid, Alert } from 'react-native';

export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // iOS has no native toast; a non-blocking alert is the closest built-in.
    Alert.alert('', message);
  }
}
