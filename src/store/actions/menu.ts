import type { StoreCore } from "../core";
import { useCallback } from "react";
import { updateFirestoreDoc } from "../../lib/firestore";
import { generateId } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { t } from "../../lib/i18n";
import type { Menu } from "../../lib/types";

export function useMenuActions(core: StoreCore) {
  const { menus } = core;


  // ============ MENUS ============
  const addMenuItem = useCallback(async (storeId: string, data: Omit<Menu, "id" | "storeId">, silent?: boolean) => {
    const id = generateId();
    await updateFirestoreDoc("menus", id, { id, storeId, ...data });
    if (!silent) showToast(t("store.menu.added"), "success"); // 메뉴판 일괄 등록은 silent 로 요약 토스트 1개만
  }, []);

  const updateMenuItem = useCallback(async (id: string, data: Partial<Menu>) => {
    await updateFirestoreDoc("menus", id, data);
  }, []);

  const deleteMenuItem = useCallback(async (id: string) => {
    await updateFirestoreDoc("menus", id, undefined, true);
  }, []);

  return { addMenuItem, updateMenuItem, deleteMenuItem };
}
