import React from 'react';
import { ViewStyle } from 'react-native';
import { Dropdown, type DropdownOption } from './Dropdown';

export type PickerOption = {
  label: string;
  value: string;
  subtitle?: string;
};

type SelectProps = {
  label?: string;
  value: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
};

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onValueChange,
  error,
  placeholder,
  containerStyle,
  disabled,
}) => {
  return (
    <Dropdown
      label={label}
      value={value}
      options={options as DropdownOption[]}
      onValueChange={onValueChange}
      error={error}
      placeholder={placeholder}
      containerStyle={containerStyle}
      disabled={disabled}
    />
  );
};
