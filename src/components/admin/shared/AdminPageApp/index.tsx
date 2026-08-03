import type {ReactNode} from "react";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Props {
  children: ReactNode;
}

export default function AdminPageApp({children}: Props) {
  return (
    <>
      {children}
      <ToastContainer newestOnTop />
    </>
  );
}
