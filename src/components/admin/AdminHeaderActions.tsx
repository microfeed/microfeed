import AdminThemeMenu from "./AdminThemeMenu";
import AdminUserMenu from "./AdminUserMenu";
import type {AdminIdentitySummary} from "./admin-shell-types";

interface Props {
  adminPath: string;
  identity: AdminIdentitySummary;
}

export default function AdminHeaderActions({adminPath, identity}: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <AdminThemeMenu />
      <AdminUserMenu adminPath={adminPath} {...identity} />
    </div>
  );
}
