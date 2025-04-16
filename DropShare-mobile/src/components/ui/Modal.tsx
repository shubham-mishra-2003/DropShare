import React from "react";
import { Modal } from "react-native";

interface ModalProps {
  children: React.ReactNode;
  visible: boolean;
  onRequestClose?: () => void;
}

const DropShareModal = ({ visible, onRequestClose, children }: ModalProps) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
};

export default DropShareModal;
