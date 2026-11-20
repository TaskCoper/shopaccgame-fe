import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { KeyRound, X, Search, Copy, Check, ShieldAlert } from "lucide-react";
import { api } from "../api";
import { useToastStore } from "../store/useToastStore";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string | null;
  balance: number;
  role: string;
}

interface UsersPage {
  data: AdminUser[];
}

interface ResetResult {
  message: string;
  email: string;
  newPassword: string;
}

interface ResetPasswordModalProps {
  onClose: () => void;
}

/**
 * Admin đặt lại mật khẩu cho user quên mật khẩu: chọn user → xác nhận → hệ thống sinh mật khẩu ngẫu nhiên
 * và hiển thị MỘT LẦN để admin gửi lại cho user (user tự đổi ở mục "Đổi mật khẩu").
 * Không dùng useMutation/query cache cho kết quả để mật khẩu chỉ nằm trong state của modal và mất khi đóng.
 */
export default function ResetPasswordModal({ onClose }: ResetPasswordModalProps) {
  const { addToast } = useToastStore();
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => setSearchDebounced(search.trim()), 400);
    return () => clearTimeout(h);
  }, [search]);

  const usersQuery = useQuery({
    queryKey: ["users", "admin", "reset-password", searchDebounced],
    queryFn: () =>
      api.get<UsersPage>("/admin/users", {
        params: { search: searchDebounced || undefined, page: 1, limit: 20 },
      }),
    enabled: result === null,
    placeholderData: keepPreviousData,
  });
  const users = usersQuery.data?.data ?? [];

  // Khi đã có mật khẩu mới, chỉ đóng bằng nút bấm rõ ràng — đóng nhầm = mất mật khẩu vĩnh viễn.
  const canDismissByBackdrop = !submitting && result === null;

  const handleReset = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await api.post<ResetResult>(`/admin/users/${selected.id}/reset-password`);
      setResult(res);
    } catch (err: any) {
      addToast(err?.message || "Đặt lại mật khẩu thất bại!", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Không thể tự sao chép — hãy bôi đen và copy thủ công.", "warning");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => canDismissByBackdrop && onClose()}
    >
      <div
        className="w-full max-w-md bg-[#2c0404] rounded-3xl border border-amber-500/20 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/15 bg-[#4d0808]">
          <h3 className="font-extrabold uppercase text-sm text-amber-300 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> Đặt lại mật khẩu user
          </h3>
          {result === null && (
            <button
              onClick={() => !submitting && onClose()}
              className="text-stone-400 hover:text-amber-400 transition"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {result ? (
          <>
            <div className="p-5 space-y-4">
              <div className="text-xs text-stone-300">
                Mật khẩu mới của <span className="font-bold text-amber-300">{result.email}</span>:
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded-xl border border-emerald-500/30 bg-[#1a0202] px-4 py-3 text-center font-mono text-xl font-black tracking-widest text-emerald-300">
                  {result.newPassword}
                </code>
                <button
                  onClick={handleCopy}
                  className="rounded-xl border border-amber-500/20 bg-stone-900/60 p-3 text-amber-300 transition hover:bg-stone-900"
                  aria-label="Sao chép mật khẩu"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-200">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Mật khẩu này <b>chỉ hiển thị một lần</b> và không thể xem lại. Hãy gửi cho user ngay, nhắc user đăng nhập
                  rồi đổi sang mật khẩu riêng ở mục <b>Đổi mật khẩu</b>.
                </span>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-amber-500/15">
              <button
                onClick={onClose}
                className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 py-2 rounded-xl font-black text-xs transition"
              >
                Đã lưu / gửi cho user — Đóng
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-stone-400">Chọn người dùng quên mật khẩu</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo email / tên / SĐT..."
                    className="w-full bg-[#1a0202] border border-amber-500/15 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500/40"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto rounded-xl border border-amber-500/10 divide-y divide-amber-500/5">
                  {usersQuery.isLoading ? (
                    <div className="text-center text-stone-500 text-xs py-4">Đang tải...</div>
                  ) : users.length === 0 ? (
                    <div className="text-center text-stone-500 text-xs py-4">Không tìm thấy người dùng nào.</div>
                  ) : (
                    users.map((u) => {
                      const isAdmin = u.role === "Admin";
                      return (
                        <button
                          key={u.id}
                          disabled={isAdmin}
                          onClick={() => setSelected(u)}
                          className={`w-full text-left px-3 py-2 transition flex items-center justify-between gap-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected?.id === u.id ? "bg-amber-700/30" : "hover:bg-stone-900/60"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-stone-100 truncate">{u.email}</div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {u.name}
                              {u.phoneNumber ? ` · ${u.phoneNumber}` : ""}
                            </div>
                          </div>
                          {isAdmin && (
                            <span className="shrink-0 text-[9px] font-bold uppercase text-stone-400">Quản trị</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {selected && (
                <div className="text-[11px] text-stone-300 bg-[#1a0202] rounded-xl px-3 py-2 border border-amber-500/10 leading-relaxed">
                  Mật khẩu hiện tại của <span className="font-bold text-amber-300">{selected.email}</span> sẽ bị thay bằng một
                  mật khẩu ngẫu nhiên mới ngay lập tức.
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-amber-500/15">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-200 py-2 rounded-xl font-bold text-xs transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleReset}
                disabled={submitting || !selected}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {submitting ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
