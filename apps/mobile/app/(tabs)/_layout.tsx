import { Tabs } from "expo-router";
import { Bell, Compass, Search, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#18181b",
        },
        headerTintColor: "#f4f4f5",
        tabBarStyle: {
          backgroundColor: "#18181b",
          borderTopColor: "#27272a",
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#71717a",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          headerTitle: "gikky.net",
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Tìm kiếm",
          headerTitle: "Tìm kiếm",
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Thông báo",
          headerTitle: "Thông báo",
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
          headerTitle: "Tài khoản",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
