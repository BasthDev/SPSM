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
              <Check size={14} color="#ffffff" strokeWidth={3} />
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

const CIRCLE_SIZE = 30;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  stepWrapper: {
    alignItems: 'center',
    maxWidth: 70,
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  completedCircle: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  circleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  activeCircleText: {
    color: '#ffffff',
  },
  label: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeLabel: {
    color: Colors.primary,
    fontWeight: '700',
  },
  completedLabel: {
    color: Colors.textSecondary,
  },
  line: {
    flex: 1,
    height: 2.5,
    marginBottom: 20,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  completedLine: {
    backgroundColor: Colors.success,
  },
  pendingLine: {
    backgroundColor: Colors.border,
  },
});
