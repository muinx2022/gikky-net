# Hai app Next (`apps/web` 3000 · `apps/admin` 3001) trong MỘT lần build.
#
# Một Dockerfile hai target chứ không hai Dockerfile: cả hai app dùng chung một
# `pnpm-lock.yaml`, chung `packages/api-client`, và `pnpm install` cho monorepo này mất
# vài phút trên máy 4 vCPU. Hai build riêng là làm hai lần đúng cái việc ấy, và tệ hơn:
# hai lần `pnpm install` ở hai thời điểm có thể ra hai cây phụ thuộc khác nhau.
#
# **KHÔNG dùng `output: standalone`**, cố ý. Nó cần `outputFileTracingRoot` trỏ gốc
# workspace pnpm, mà `next.config.ts` hiện đã có `outputFileTracingIncludes` cho ba file
# TTF của ảnh OG (đọc lúc CHẠY bằng `fs.readFile`, tracing không thấy). Đổi sang standalone
# là đụng vào đúng cơ chế đó — một việc phải có bài đo riêng, không phải một dòng tiện tay
# trong lượt deploy đầu tiên. Cái giá: image to hơn vì mang cả `node_modules`.

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    # `@playwright/test` là devDependency của apps/web và `pnpm install` dưới đây cài cả
    # dev (bước build cần typescript + eslint-config-next). Không có dòng này thì mỗi lần
    # build kéo về ~300 MB trình duyệt Chromium mà image prod không bao giờ chạy.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------
FROM base AS deps
# Chỉ manifest — sửa một file .tsx không làm cài lại toàn bộ node_modules.
# `.npmrc` BẮT BUỘC có mặt: nó mang `public-hoist-pattern[]=*eslint*`, thiếu nó thì
# `next build` chết với "Cannot find module 'eslint-plugin-react-hooks'" (xem CLAUDE.md).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json          apps/web/
COPY apps/admin/package.json        apps/admin/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM base AS builder
# Chép **cả `/repo`** của stage `deps`, không phải từng `node_modules` một.
#
# Bản đầu liệt kê bốn đường dẫn `node_modules` bằng tay và ĐỎ ngay lần build đầu tiên:
# `packages/api-client` không có dependency nào, nên pnpm **không tạo** `node_modules` ở đó
# và `COPY --from=deps .../packages/api-client/node_modules` trỏ vào chỗ không tồn tại.
# Danh sách viết tay ở đây là một bản sao của "gói nào có dependency" — một sự thật do
# `pnpm-lock.yaml` quyết định và đổi được bất cứ lúc nào mà không ai báo.
#
# `COPY . .` ngay sau đây ghi đè mọi manifest bằng bản thật, còn `node_modules` thì sống
# sót vì `.dockerignore` loại nó khỏi context — nên không có bản nào của host lọt vào.
COPY --from=deps /repo /repo
COPY . .

# `API_ORIGIN` / `SITE_ORIGIN` được truyền ở CẢ build lẫn run.
#
# Ở run thì hiển nhiên. Ở build là để phòng: cả hai được đọc ở **module scope**
# (`lib/api.ts:31`, `lib/site.ts:11`), và một bản Next nào đó nội tuyến `process.env.X`
# trong bundle server sẽ đóng băng giá trị lúc build. Truyền cả hai chỗ thì dù Next đổi ý
# kiểu nào, giá trị vẫn đúng — thay vì `http://localhost:8000` bị nướng vào image.
#
# `REVALIDATE_SECRET` thì NGƯỢC LẠI: chỉ ở run, không ở build. Nó được đọc **trong thân
# handler** (`app/lam-moi-cache/route.ts::secretCuaCua`), nên runtime env là đủ — và một
# secret truyền qua `ARG` nằm lại vĩnh viễn trong lớp image, đọc được bằng `docker history`.
#
# `DEM_LUOT_XEM_SECRET` là NGOẠI LỆ của đoạn ngay trên: nó **phải** có mặt lúc build, và
# vì thế nó **bị nướng vào lớp image**, đọc được bằng `docker history`. Không tránh được:
# nó được đọc trong `middleware.ts`, tức **edge runtime**, mà Next nội tuyến `process.env.X`
# của edge lúc BUILD chứ không đọc lúc chạy (xem `lib/dem-luot-xem.ts::secretDem`, dòng
# 153-157 nói thẳng điều này). Đặt nó chỉ ở `environment:` của compose thì cửa đếm **im
# lặng tắt** — middleware thấy chuỗi rỗng và bỏ qua mọi lượt xem, không log, không lỗi.
#
# ⚠ **Thiếu dòng `ARG` này là hỏng theo đúng kiểu đó.** `compose.yml` có truyền build-arg,
# nhưng Docker **bỏ qua build-arg mà Dockerfile không khai** — chỉ in một dòng cảnh báo
# lẫn giữa hàng trăm dòng build. Đó chính là trạng thái của file này trước 2026-08-27.
#
# Mức rủi ro của việc nướng secret vào image, nói thẳng để người sau khỏi phải đoán: image
# này **không đẩy lên registry nào**, nó chỉ nằm trên chính máy đã có `app/.env`. Và nếu lộ
# thì hậu quả là ai đó bơm được số lượt xem — không phải quyền đọc/ghi dữ liệu.
ARG API_ORIGIN=http://api:8000
ARG SITE_ORIGIN=https://gikky.net
ARG DEM_LUOT_XEM_SECRET=""
ENV API_ORIGIN=$API_ORIGIN \
    SITE_ORIGIN=$SITE_ORIGIN \
    DEM_LUOT_XEM_SECRET=$DEM_LUOT_XEM_SECRET \
    NODE_ENV=production

# Tuần tự, KHÔNG song song: máy chỉ còn ~3.4 GiB RAM trống và đang gánh 4 stack khác.
# Hai `next build` cùng lúc là đường ngắn nhất tới OOM-killer — mà OOM giữa `next build`
# ra một `.next/` DỞ DANG chứ không phải một lỗi đọc được.
RUN pnpm --filter @gikky/web build
RUN pnpm --filter @gikky/admin build

# ---------------------------------------------------------------------------
# Hai target cuối dùng chung mọi lớp của `builder` ⇒ Docker lưu MỘT bản trên đĩa, không hai.
FROM builder AS web
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "--port", "3000", "--hostname", "0.0.0.0"]

FROM builder AS admin
WORKDIR /repo/apps/admin
EXPOSE 3001
CMD ["pnpm", "exec", "next", "start", "--port", "3001", "--hostname", "0.0.0.0"]
