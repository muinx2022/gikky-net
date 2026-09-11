import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../context/AuthContext";
import { GoogleOneTap } from "../components/GoogleOneTap";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1 phút
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: "#18181b",
              },
              headerTintColor: "#f4f4f5",
              headerTitleStyle: {
                fontWeight: "bold" as const,
              },
              contentStyle: {
                backgroundColor: "#121212",
              },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="mach/[id]"
              options={{
                title: "Chi tiết Mạch",
                headerBackTitle: "Quay lại",
              }}
            />
            <Stack.Screen
              name="mach/new"
              options={{
                title: "Tạo Mạch mới",
                headerBackTitle: "Quay lại",
              }}
            />
            <Stack.Screen
              name="login"
              options={{
                presentation: "modal",
                title: "Đăng nhập",
              }}
            />
          </Stack>
          <GoogleOneTap />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
