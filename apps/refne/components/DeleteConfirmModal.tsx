"use client";

import { Modal, Text, Button, Group } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  opened,
  onClose,
  onConfirm,
  title = 'Delete Confirmation',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  loading = false,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      radius="lg"
      styles={{
        title: {
          fontWeight: 600,
          fontSize: '1.125rem',
        },
      }}
    >
      <Group mb="lg" gap="sm">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={20} color="#dc2626" />
        </div>
        <Text size="sm" c="#64748b" style={{ flex: 1 }}>
          {message}
        </Text>
      </Group>

      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          color="red"
          onClick={onConfirm}
          loading={loading}
          styles={{
            root: {
              backgroundColor: '#dc2626',
              '&:hover': {
                backgroundColor: '#b91c1c',
              },
            },
          }}
        >
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
