import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from 'react-native';
import { Colors } from '@/theme/theme';

type SectionProps = {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
} & ViewProps;

export const Section: React.FC<SectionProps> = ({ style, children, ...rest }) => {
  return (
    <View style={[styles.container, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 8,
  },
});
