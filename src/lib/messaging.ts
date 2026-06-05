import { t } from "./i18n";

export type SmsMode = "aligo" | "gateway" | "device";

export interface AligoCreds {
  key: string;
  userId: string;
  sender: string;
}

export async function sendPhysicalSms(
  phone: string,
  content: string,
  mode: SmsMode,
  options: { aligo?: AligoCreds; gatewayUrl?: string } = {}
): Promise<{ ok: boolean; message?: string }> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone) return { ok: false, message: t("messaging.invalidPhone") };

  if (mode === "aligo" && options.aligo) {
    try {
      const fd = new FormData();
      fd.append("key", options.aligo.key);
      fd.append("user_id", options.aligo.userId);
      fd.append("sender", options.aligo.sender);
      fd.append("receiver", cleanPhone);
      fd.append("msg", content);
      const res = await fetch("https://apis.aligo.in/send/", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("aligo failed");
      return { ok: true };
    } catch {
      // fallback to device
      return sendPhysicalSms(phone, content, "device");
    }
  }

  if (mode === "gateway" && options.gatewayUrl) {
    try {
      const url = `${options.gatewayUrl.replace(/\/$/, "")}/send?phone=${encodeURIComponent(
        cleanPhone
      )}&message=${encodeURIComponent(content)}`;
      const res = await fetch(url);
      return { ok: res.ok };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    }
  }

  // device deeplink
  if (typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    const isIos = /iPhone|iPad/i.test(navigator.userAgent);
    const sep = isIos ? "&" : "?";
    window.location.href = `sms:${cleanPhone}${sep}body=${encodeURIComponent(content)}`;
    return { ok: true };
  }
  return { ok: false, message: t("messaging.pcNoSms") };
}

export async function sendKakaoMessage(
  content: string,
  storeName: string,
  storeId: string
): Promise<{ ok: boolean; message?: string }> {
  const Kakao = (window as any).Kakao;
  if (!Kakao?.isInitialized?.()) {
    return { ok: false, message: t("messaging.kakaoNotInit") };
  }
  try {
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: storeName,
        description: content,
        imageUrl: "",
        link: {
          mobileWebUrl: `${window.location.origin}/customer/store/${storeId}`,
          webUrl: `${window.location.origin}/customer/store/${storeId}`,
        },
      },
      buttons: [
        {
          title: t("messaging.visitTitle"),
          link: {
            mobileWebUrl: `${window.location.origin}/customer/store/${storeId}`,
            webUrl: `${window.location.origin}/customer/store/${storeId}`,
          },
        },
      ],
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message };
  }
}
