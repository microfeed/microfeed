import type {ReactNode} from "react";

interface Props {
  children: ReactNode;
}

export default function AdminPageApp({children}: Props) {
  return <>{children}</>;
}
