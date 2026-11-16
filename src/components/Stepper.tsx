import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, ViewProps } from 'react-native';
import { Check } from 'lucide-react-native';
import { Colors } from '@/theme/theme';

type StepperProps = {
  steps: string[];
  currentStep: number;
  onStepChange?: (stepIndex: number) => void;
  style?: StyleProp<ViewStyle>;
} & ViewProps;

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepChange,
  style,
  ...rest
}) => {
  return (
    <View style={[styles.container, style]} {...rest}>
      {steps.map((label, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        const circle = (
          <View
            style={[
              styles.circle,
              isActive && styles.activeCircle,
              isCompleted && styles.completedCircle,
            ]}
          >
            {isCompleted ? (
              <Check size={15} color="#ffffff" strokeWidth={3.2} />
            ) : (
              <Text
                style={[
                  styles.circleText,
                  (isActive || isCompleted) && styles.activeCircleText,
                ]}
              >
                {idx + 1}
              </Text>
            )}
          </View>
        );

        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              {onStepChange && isCompleted ? (
                <TouchableOpacity onPress={() => onStepChange(idx)} activeOpacity={0.7}>
                  {circle}
                </TouchableOpacity>
              ) : (
                circle
              )}
              <Text
                style={[
                  styles.label,
                  isActive && styles.activeLabel,
                  isCompleted && styles.completedLabel,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>

            {idx < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  idx < currentStep ? styles.completedLine : styles.pendingLine,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const CIRCLE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  stepWrapper: {
    alignItems: 'center',
    maxWidth: 72,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  activeCircle: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  completedCircle: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  circleText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '700',
  },
  activeCircleText: {
    color: '#ffffff',
  },
  label: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 7,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeLabel: {
    color: Colors.primary,
    fontWeight: '800',
  },
  completedLabel: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  line: {
    flex: 1,
    height: 3,
    marginTop: CIRCLE_SIZE / 2 - 1.5,
    marginHorizontal: 6,
    borderRadius: 2,
  },
  completedLine: {
    backgroundColor: Colors.success,
  },
  pendingLine: {
    backgroundColor: Colors.border,
  },
});
