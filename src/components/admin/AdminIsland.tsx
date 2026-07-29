import {
  type ComponentType,
  useEffect,
  useState,
} from "react";

export type AdminIslandKind =
  | "channel"
  | "code-editor"
  | "home"
  | "item"
  | "items"
  | "settings";

type ApplicationModule = Promise<{default: ComponentType}>;

const applicationLoaders: Record<
  AdminIslandKind,
  () => ApplicationModule
> = {
  channel: () =>
    import("./channel/EditChannelApp"),
  "code-editor": () =>
    import("./code-editor/CustomCodeEditorApp"),
  home: () =>
    import("./home/AdminHomeApp"),
  item: () =>
    import("./items/EditItemApp"),
  items: () =>
    import("./items/AllItemsApp"),
  settings: () =>
    import("./settings/SettingsApp"),
};

export default function AdminIsland({kind}: {kind: AdminIslandKind}) {
  const [Application, setApplication] = useState<ComponentType | null>(null);
  useEffect(() => {
    let active = true;
    void applicationLoaders[kind]().then((module) => {
      if (active) {
        setApplication(() => module.default);
      }
    });
    return () => {
      active = false;
    };
  }, [kind]);
  return Application ? <Application /> : null;
}
