import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Top padding that keeps a screen header clear of the status bar, notch or
// Dynamic Island on every device, instead of a fixed guess.
export function useHeaderInset(extra = 12) {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

// Screens presented as iOS modals are sheets that already start below the
// status bar, so they only need breathing room; Android modals are full screen.
export function useModalHeaderInset(extra = 12) {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? 20 : insets.top + extra;
}

// Bottom padding that clears the home indicator, with a floor for devices
// that have none.
export function useBottomInset(min = 12) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, min);
}
