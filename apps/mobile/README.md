# @gikky/mobile — Ứng dụng di động gikky.net (MVP)

Ứng dụng di động cho gikky.net xây dựng bằng **React Native + Expo SDK 52** (Expo Router), tích hợp trực tiếp `@gikky/api-client`.

## Khởi động & Phát triển

Ở thư mục gốc monorepo:

```bash
# Cài đặt dependencies (nếu mới clone)
pnpm install

# Khởi động Expo Dev Server
pnpm mobile:start

# Hoặc mở trực tiếp trên Android / iOS emulator:
pnpm mobile:android
pnpm mobile:ios
```

## Kết nối tới Django Backend

Mặc định, ứng dụng gọi:
- Android Emulator: `http://10.0.2.2:8000`
- iOS Simulator / Web: `http://localhost:8000`

Nếu chạy trên **thiết bị thật qua Expo Go**, hãy tạo file `apps/mobile/.env` và trỏ IP máy tính trong mạng LAN:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.xxx:8000
```

Bạn cũng có thể kiểm tra trạng thái kết nối trực tiếp trong tab **Cá nhân -> Kiểm tra kết nối API**.
