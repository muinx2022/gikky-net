"use client";

import { createContext, useContext, useMemo, useState } from "react";

/** Quản lý form bình luận đang mở trên toàn trang mạch.
 *
 * Tiêu chí: chỉ duy nhất 1 form bình luận (ô chính khán đài, ô ngăn kéo, form reply, hoặc form sửa)
 * được mở tại một thời điểm. Mở form mới sẽ tự động đóng form cũ.
 */
type NguCanhFormBinhLuan = {
  formDangMo: string | null;
  moForm: (id: string) => void;
  dongForm: (id?: string) => void;
};

const NguCanh = createContext<NguCanhFormBinhLuan | null>(null);

export function FormBinhLuanProvider({ children }: { children: React.ReactNode }) {
  const [formDangMo, datFormDangMo] = useState<string | null>(null);

  const value = useMemo<NguCanhFormBinhLuan>(
    () => ({
      formDangMo,
      moForm: (id: string) => datFormDangMo(id),
      dongForm: (id?: string) => {
        datFormDangMo((current) => (id === undefined || current === id ? null : current));
      },
    }),
    [formDangMo],
  );

  return <NguCanh.Provider value={value}>{children}</NguCanh.Provider>;
}

export function useFormBinhLuan(): NguCanhFormBinhLuan | null {
  return useContext(NguCanh);
}
