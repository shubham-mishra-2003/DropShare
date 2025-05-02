import React from "react";
import { Modal } from "react-native";

interface ModalProps {
  children: React.ReactNode;
  visible: boolean;
  onRequestClose?: () => void;
  animationType?: "slide" | "fade" | "none";
}

const DropShareModal = ({
  visible,
  onRequestClose,
  children,
  animationType = "slide",
}: ModalProps) => {
  return (
    <Modal
      animationType={animationType}
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
};

export default DropShareModal;
