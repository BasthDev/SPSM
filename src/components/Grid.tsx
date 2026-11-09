import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from 'react-native';

type GridProps = {
  /** Number of columns in the grid */
  columns?: number;
  /** Gap between items (both row and column) */
  gap?: number;
  /** Style override */
  style?: StyleProp<ViewStyle>;
  /** Children to layout */
  children: React.ReactNode;
} & ViewProps;

export const Grid: React.FC<GridProps> = ({ columns = 2, gap = 8, children, style, ...rest }) => {
  const childArray = React.Children.toArray(children);
  return (
    <View style={[styles.container, { margin: -gap / 2 }, style]} {...rest}>
      {childArray.map((child, idx) => (
        <View
          key={idx}
          style={{ padding: gap / 2, width: `${100 / columns}%` }}
        >
          {child}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
