"use client";

import { Title, Text, Box, Paper, Center, Stack } from '@mantine/core';
import { Settings, Wrench } from 'lucide-react';

export default function SettingsPage() {
  return (
    <Box>
      <Box mb="xl">
        <Title order={1} fw={700} mb="xs" c="#0f172a" style={{ fontSize: '2rem' }}>
          Settings
        </Title>
        <Text size="md" c="#64748b">
          Configure your application settings
        </Text>
      </Box>

      <Paper
        shadow="xs"
        radius="lg"
        p="xl"
        style={{
          border: '1px solid #e2e8f0',
          minHeight: '400px',
        }}
      >
        <Center style={{ height: '350px' }}>
          <Stack align="center" gap="lg">
            <Box
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Settings size={32} color="#64748b" />
              <Box
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid white',
                }}
              >
                <Wrench size={14} color="#f59e0b" />
              </Box>
            </Box>
            <Stack align="center" gap="xs">
              <Title order={3} fw={600} c="#0f172a">
                Đang cập nhật
              </Title>
              <Text size="sm" c="#64748b" ta="center" maw={400}>
                Trang cài đặt đang được phát triển. Vui lòng quay lại sau để cấu hình các thiết lập của bạn.
              </Text>
            </Stack>
          </Stack>
        </Center>
      </Paper>
    </Box>
  );
}
