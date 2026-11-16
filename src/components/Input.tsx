import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  ViewStyle,
  TextInputProps as RNTextInputProps,
} from 'react-native';
import { Colors } from '@/theme/theme';

type InputProps = {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
} & RNTextInputProps;

export const Input = forwardRef<any, InputProps>(function Input({
  label,
  error,
  hint,
  containerStyle,
  style,
  ...rest
}, ref) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        ref={ref}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : undefined,
          style,
        ]}
        placeholderTextColor={Colors.placeholder}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 7,
    letterSpacing: -0.1,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: Colors.input,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: '#ffffff',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  inputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  error: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 5,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 5,
  },
});
