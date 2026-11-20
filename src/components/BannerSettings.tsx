import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Upload, RotateCcw } from "lucide-react";
import { api, uploadBanner, bannerTypeOf, ALLOWED_BANNER_TYPES, MAX_BANNER_BYTES, type BannerType } from "../api";
import { useToastStore } from "../store/useToastStore";
import ConfirmDialog from "./ConfirmDialog";
import defaultBannerMp4 from "../assets/images/hero-banner.mp4";

interface BannerSettingsData {
  bannerUrl?: string;
  bannerType?: string;
}

/** Hiển thị 1 banner (ảnh/video) trong khung 16:9 dùng cho cả preview hiện tại lẫn file vừa chọn. */
function BannerPreview({ src, type }: { src: string; type: BannerType }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-[#1c0202]">
      {type === "video" ? (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <img src={src} alt="Banner" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

/**
 * Admin đổi banner trang chủ: chọn ảnh/video → upload lên storage → lưu URL qua PUT /settings/banner.
 * Không còn dùng file cố định trong source; banner mặc định chỉ là fallback khi chưa cấu hình.
 * Không đặt trong <form> khác (các nút ở đây đều type="button").
 */
export default function BannerSettings() {
  const { addToast } = useToastStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dùng chung query key với App => khi lưu xong chỉ cần invalidate là cả trang chủ cập nhật.
  const { data: settings } = useQuery({
    queryKey: ["systemSettings"],
    queryFn: () => api.get<BannerSettingsData>("/settings"),
    staleTime: 5 * 60 * 1000,
  });

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Tạo/thu hồi object URL để xem trước file vừa chọn (tránh rò rỉ bộ nhớ).
  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const currentUrl = settings?.bannerUrl || "";
  const currentType: BannerType = settings?.bannerType === "image" ? "image" : "video";
  const pendingType = pendingFile ? bannerTypeOf(pendingFile) : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại đúng file đó lần sau
    if (!file) return;

    if (!bannerTypeOf(file)) {
      addToast("Định dạng không hợp lệ. Chỉ chấp nhận JPEG, PNG, WEBP, GIF, MP4, WEBM.", "error");
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      addToast("Banner vượt quá dung lượng tối đa 50MB.", "error");
      return;
    }
    setPendingFile(file);
  };

  const saveBanner = async (url: string, type: string) => {
    const res = await api.put<{ message: string }>("/settings/banner", { bannerUrl: url, bannerType: type });
    await queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    return res.message;
  };

  const handleSave = async () => {
    if (!pendingFile) return;
    setSaving(true);
    setProgress(0);
    try {
      const { url, type } = await uploadBanner(pendingFile, setProgress);
      const message = await saveBanner(url, type);
      addToast(message || "Cập nhật banner thành công!", "success");
      setPendingFile(null);
    } catch (err: any) {
      addToast(err?.message || "Cập nhật banner thất bại!", "error");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const handleResetToDefault = async () => {
    setResetConfirmOpen(false);
    setSaving(true);
    try {
      const message = await saveBanner("", "");
      addToast(message || "Đã khôi phục banner mặc định!", "success");
      setPendingFile(null);
    } catch (err: any) {
      addToast(err?.message || "Khôi phục banner thất bại!", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#2c0404]/80 p-5 rounded-2xl border border-amber-500/10 space-y-4">
      <div className="border-b border-rose-900/40 pb-2">
        <h5 className="font-extrabold text-xs uppercase text-amber-300 tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4" /> Banner trang chủ
        </h5>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-stone-300 uppercase">
            Đang hiển thị {currentUrl ? "" : "(mặc định)"}
          </div>
          <BannerPreview src={currentUrl || defaultBannerMp4} type={currentUrl ? currentType : "video"} />
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold text-stone-300 uppercase">Banner mới</div>
          {pendingFile && pendingPreviewUrl && pendingType ? (
            <BannerPreview src={pendingPreviewUrl} type={pendingType} />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-500/25 bg-red-950/40 text-stone-400 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50"
            >
              <Upload className="w-6 h-6" />
              <span className="text-xs font-bold">Chọn ảnh hoặc video</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_BANNER_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />

      {pendingFile && (
        <div className="text-[11px] text-stone-300">
          Đã chọn: <span className="font-bold text-amber-300">{pendingFile.name}</span>{" "}
          ({(pendingFile.size / (1024 * 1024)).toFixed(2)}MB)
        </div>
      )}

      {progress !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-red-950">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {pendingFile ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {saving ? (progress !== null ? `Đang tải lên ${progress}%...` : "Đang lưu...") : "Lưu banner"}
            </button>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              disabled={saving}
              className="rounded-xl bg-stone-800 px-4 py-2 text-xs font-bold text-stone-200 transition hover:bg-stone-700 disabled:opacity-50"
            >
              Hủy chọn
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> Chọn banner mới
          </button>
        )}

        {currentUrl && !pendingFile && (
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-stone-900/60 px-4 py-2 text-xs font-bold text-stone-300 transition hover:bg-stone-900 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
          </button>
        )}
      </div>

      <p className="text-[10px] text-stone-400 italic">
        Hỗ trợ JPEG, PNG, WEBP, GIF, MP4, WEBM — tối đa 50MB. Tỉ lệ khuyến nghị 16:9. Video sẽ tự phát, tắt tiếng và lặp lại.
      </p>

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        title="KHÔI PHỤC BANNER MẶC ĐỊNH"
        message="Banner hiện tại sẽ được gỡ khỏi trang chủ và thay bằng banner mặc định. Bạn có chắc chắn không?"
        confirmText="Khôi phục"
        cancelText="Hủy bỏ"
        onConfirm={handleResetToDefault}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
