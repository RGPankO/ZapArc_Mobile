// StyledTextInput Component
// A themed TextInput wrapper that automatically applies correct background color
// for outlined mode to ensure floating labels work properly with the border

import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { TextInput, TextInputProps } from 'react-native-paper';
import { useAppTheme } from '../contexts/ThemeContext';
import { getInputBackgroundColor, getPrimaryTextColor, getSecondaryTextColor } from '../utils/theme-helpers';

// =============================================================================
// Types
// =============================================================================

export interface StyledTextInputProps extends Omit<TextInputProps, 'theme'> {
  // Allow passing additional style
  style?: StyleProp<ViewStyle>;
}

// =============================================================================
// Component
// =============================================================================

export function StyledTextInput({ 
  style, 
  mode = 'outlined',
  outlineColor,
  activeOutlineColor,
  textColor,
  placeholderTextColor,
  ...props 
}: StyledTextInputProps): React.JSX.Element {
  const { themeMode } = useAppTheme();
  
  // Get theme-aware colors
  const inputBackgroundColor = getInputBackgroundColor(themeMode);
  const primaryText = getPrimaryTextColor(themeMode);
  const secondaryText = getSecondaryTextColor(themeMode);
  
  // Default colors based on theme
  const defaultOutlineColor = themeMode === 'dark' 
    ? 'rgba(255, 255, 255, 0.3)' 
    : 'rgba(0, 0, 0, 0.3)';
  const defaultActiveOutlineColor = themeMode === 'dark' ? '#FFC107' : '#F57F17'; // Brand gold (darker for light mode)
  const defaultTextColor = primaryText;
  const defaultPlaceholderColor = secondaryText;

  return (
    <TextInput
      mode={mode}
      style={[
        styles.input,
        { backgroundColor: inputBackgroundColor },
        style,
      ]}
      theme={{ colors: { background: inputBackgroundColor } }}
      outlineColor={outlineColor ?? defaultOutlineColor}
      activeOutlineColor={activeOutlineColor ?? defaultActiveOutlineColor}
      textColor={textColor ?? defaultTextColor}
      placeholderTextColor={placeholderTextColor ?? defaultPlaceholderColor}
      {...props}
    />
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  input: {
    // Base styles can go here if needed
  },
});

// =============================================================================
// Export
// =============================================================================

export default StyledTextInput;
