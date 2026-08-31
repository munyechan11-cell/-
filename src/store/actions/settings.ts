import type { StoreCore } from "../core";
import { useCallback } from "react";
import { updateFirestoreDoc } from "../../lib/firestore";
import type { User } from "../../lib/types";

export function useSettingsActions(core: StoreCore) {
  const { currentUser, users, setCurrentUser } = core;


  const updateBrandSettings = useCallback(async (storeId: string, data: Partial<User>) => {
    await updateFirestoreDoc("users", storeId, data);
    if (currentUser?.id === storeId) setCurrentUser({ ...currentUser, ...data });
  }, [currentUser, setCurrentUser]);

  const updateStoreConfig = useCallback(
    async (storeId: string, partial: Partial<NonNullable<User["storeConfig"]>>) => {
      const target = users.find((u) => u.id === storeId);
      const next = { ...(target?.storeConfig ?? {}), ...partial } as NonNullable<User["storeConfig"]>;
      await updateFirestoreDoc("users", storeId, { storeConfig: next });
      if (currentUser?.id === storeId) {
        setCurrentUser({ ...currentUser, storeConfig: next });
      }
    },
    [users, currentUser, setCurrentUser]
  );


  const updateStoreLocation = useCallback(
    async (storeId: string, lat: number, lng: number) => {
      await updateFirestoreDoc("users", storeId, { lat, lng });
      if (currentUser?.id === storeId) setCurrentUser({ ...currentUser, lat, lng });
    },
    [currentUser, setCurrentUser]
  );

  return { updateBrandSettings, updateStoreConfig, updateStoreLocation };
}
