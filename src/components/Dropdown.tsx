import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  ViewStyle,
  TouchableWithoutFeedback,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Colors } from '@/theme/theme';
import { ChevronDown, Check, Search, X } from 'lucide-react-native';

export interface DropdownOption {
  label: string;
  value: string;
  subtitle?: string;
}

interface DropdownProps {
  label?: string;
  value: string;
  options: DropdownOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Pilih salah satu...',
  error,
  containerStyle,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchQuery.trim()
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (opt.subtitle && opt.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  const handleSelect = (val: string) => {
    onValueChange(val);
    setModalVisible(false);
    setSearchQuery('');
  };

  const handleClose = () => {
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Trigger Box */}
      <TouchableOpacity
        style={[
          styles.triggerBox,
          error ? styles.triggerBoxError : null,
          disabled ? styles.triggerBoxDisabled : null,
          modalVisible ? styles.triggerBoxActive : null,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        activeOpacity={0.75}
        disabled={disabled}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedOption ? styles.triggerPlaceholder : null,
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>

        <ChevronDown
          size={19}
          color={modalVisible ? Colors.primary : Colors.textTertiary}
          strokeWidth={2.2}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal Bottom Sheet Picker */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <SafeAreaView style={styles.modalCard}>
                {/* Drag Handle */}
                <View style={styles.dragHandle} />

                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {label ? `Pilih ${label}` : 'Pilih Opsi'}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={20} color={Colors.textSecondary} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                {/* Search Input if more than 5 options */}
                {options.length > 5 && (
                  <View style={styles.searchBox}>
                    <Search size={16} color={Colors.textTertiary} strokeWidth={2} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Cari..."
                      placeholderTextColor={Colors.textTertiary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      clearButtonMode="while-editing"
                    />
                  </View>
                )}

                {/* Options List */}
                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => item.value}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Tidak ada opsi yang cocok</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSelected = item.value === value;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          isSelected && styles.optionItemSelected,
                        ]}
                        onPress={() => handleSelect(item.value)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.optionTextCol}>
                          <Text
                            style={[
                              styles.optionLabel,
                              isSelected && styles.optionLabelSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={styles.optionSubtitle}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>

                        {isSelected && (
                          <View style={styles.checkCircle}>
                            <Check size={14} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </SafeAreaView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 7,
    letterSpacing: -0.2,
  },
  triggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.input,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  triggerBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  triggerBoxError: {
    borderColor: Colors.error,
  },
  triggerBoxDisabled: {
    opacity: 0.6,
  },
  triggerText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 10,
  },
  triggerPlaceholder: {
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 5,
    marginLeft: 2,
    fontWeight: '500',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 9999,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  optionTextCol: {
    flex: 1,
    marginRight: 10,
  },
  optionLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.text,
  },
  optionLabelSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  optionSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
