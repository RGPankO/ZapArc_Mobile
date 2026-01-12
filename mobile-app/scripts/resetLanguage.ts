// Quick script to reset language to English
// Run with: npx ts-node scripts/resetLanguage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

async function resetLanguage() {
  try {
    await AsyncStorage.setItem('@user_settings', JSON.stringify({
      language: 'en',
      currency: 'sats',
      autoLockTimeout: 900,
    }));
    console.log('✅ Language reset to English');
  } catch (error) {
    console.error('❌ Failed to reset language:', error);
  }
}

resetLanguage();
