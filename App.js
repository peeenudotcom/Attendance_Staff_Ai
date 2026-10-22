import React from 'react';
import { Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { LanguageProvider } from './src/i18n';

// Phones set to very large text would push screens off the edge; let text grow a little, not without limit.
Text.defaultProps = { ...(Text.defaultProps || {}), maxFontSizeMultiplier: 1.2 };
TextInput.defaultProps = { ...(TextInput.defaultProps || {}), maxFontSizeMultiplier: 1.2 };

function AppContent() {
  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
